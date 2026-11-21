'use strict';

require('dotenv').config();

const postgres = require('postgres');

const IDENTITY_TABLES = new Set([
  'ad_clicks', 'ad_impressions', 'ad_spaces', 'admin_logs', 'business_campaigns',
  'business_notifications', 'business_post_comments', 'business_post_shares', 'business_posts',
  'business_reports', 'business_stories', 'businesses', 'campaign_creatives', 'comments',
  'conversations', 'courses', 'events', 'friendships', 'group_messages', 'groups_table',
  'hashtags', 'highlights', 'invoices', 'messages', 'notices', 'notifications',
  'password_reset_tokens', 'payments', 'post_shares', 'posts', 'reports', 'stories',
  'story_privacy_exceptions', 'story_reactions', 'story_replies', 'units', 'units_catalog',
  'user_restrictions', 'user_warnings', 'users'
]);

const BOOLEAN_COLUMNS = new Set([
  'is_valid', 'is_active', 'is_read', 'is_sponsored', 'is_edited', 'deleted_for_everyone',
  'is_private', 'is_pinned', 'send_notification', 'used', 'privacy_showemail', 'hide_email',
  'is_blocked', 'is_business_owner', 'onboarding_completed', 'is_verified', 'is_online'
]);

const UPSERT_CONFLICTS = {
  story_privacy_exceptions: 'ON CONFLICT (story_id, user_id) DO UPDATE SET exception_type = EXCLUDED.exception_type',
  group_muted: 'ON CONFLICT (group_id, user_id) DO UPDATE SET muted_at = NOW()',
  group_important: 'ON CONFLICT (group_id, user_id) DO UPDATE SET marked_at = NOW()',
  group_last_read: 'ON CONFLICT (group_id, user_id) DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id',
  group_admins: 'ON CONFLICT (group_id, admin_id) DO UPDATE SET assigned_at = NOW()'
};

let sqlClient;

function getSqlClient() {
  if (sqlClient) return sqlClient;

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      'Banco Supabase não configurado. Defina DATABASE_URL com a URI PostgreSQL copiada em Supabase > Connect.'
    );
  }

  sqlClient = postgres(connectionString, {
    ssl: process.env.DB_SSL === 'disable' ? false : 'require',
    max: Number(process.env.DB_POOL_MAX || 10),
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {}
  });

  return sqlClient;
}

function normalizeMysqlQuotes(source) {
  let output = '';
  let state = 'normal';

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'normal') {
      if (char === "'") {
        state = 'single';
        output += char;
      } else if (char === '"') {
        state = 'double';
        output += "'";
      } else if (char === String.fromCharCode(96)) {
        state = 'backtick';
        output += '"';
      } else if (char === '-' && next === '-') {
        state = 'line-comment';
        output += '--';
        i += 1;
      } else if (char === '/' && next === '*') {
        state = 'block-comment';
        output += '/*';
        i += 1;
      } else {
        output += char;
      }
      continue;
    }

    if (state === 'line-comment') {
      output += char;
      if (char === '\n') state = 'normal';
      continue;
    }

    if (state === 'block-comment') {
      output += char;
      if (char === '*' && next === '/') {
        output += '/';
        i += 1;
        state = 'normal';
      }
      continue;
    }

    if (state === 'single') {
      output += char;
      if (char === "'" && next === "'") {
        output += next;
        i += 1;
      } else if (char === "'" && source[i - 1] !== '\\') {
        state = 'normal';
      }
      continue;
    }

    if (state === 'double' || state === 'backtick') {
      const closing = state === 'double' ? '"' : String.fromCharCode(96);
      if (char === closing && next === closing) {
        output += state === 'double' ? "''" : '""';
        i += 1;
      } else if (char === closing) {
        output += state === 'double' ? "'" : '"';
        state = 'normal';
      } else if (state === 'double' && char === "'") {
        output += "''";
      } else {
        output += char;
      }
    }
  }

  return output;
}

function translateQuery(originalSql, originalParams = []) {
  if (typeof originalSql !== 'string' || !originalSql.trim()) {
    throw new TypeError('A consulta SQL precisa ser uma string não vazia.');
  }

  const params = Array.isArray(originalParams) ? originalParams : [originalParams];
  let sql = normalizeMysqlQuotes(originalSql.trim());
  let ignoreConflicts = false;

  sql = sql.replace(/\bDATE_SUB\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, " (NOW() - INTERVAL '$1 days')");
  sql = sql.replace(/\bDATE_SUB\s*\(\s*CURDATE\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, " (CURRENT_DATE - INTERVAL '$1 days')");
  sql = sql.replace(/\bCURDATE\s*\(\s*\)/gi, 'CURRENT_DATE');
  sql = sql.replace(/\bDATABASE\s*\(\s*\)/gi, 'current_schema()');
  sql = sql.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
  sql = sql.replace(/\bLIKE\b/gi, 'ILIKE');
  sql = sql.replace(new RegExp(String.fromCharCode(96), 'g'), '"');

  sql = sql.replace(/\bINSERT\s+IGNORE\s+INTO\b/i, () => {
    ignoreConflicts = true;
    return 'INSERT INTO';
  });

  const insertMatch = sql.match(/\bINSERT\s+INTO\s+("?[\w]+"?)(?:\s*\.)?("?[\w]+"?)?/i);
  const insertTable = insertMatch
    ? (insertMatch[2] || insertMatch[1]).replace(/"/g, '').toLowerCase()
    : null;

  const duplicateMatch = sql.match(/\s+ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]*$/i);
  if (duplicateMatch) {
    const conflictClause = UPSERT_CONFLICTS[insertTable];
    if (!conflictClause) {
      throw new Error(
        'Consulta MySQL ON DUPLICATE KEY UPDATE sem regra PostgreSQL definida para a tabela ' +
        String(insertTable) + '.'
      );
    }
    sql = sql.slice(0, duplicateMatch.index) + ' ' + conflictClause;
  }

  sql = sql.replace(
    /\b(is_valid|is_active|is_read|is_sponsored|is_edited|deleted_for_everyone|is_private|is_pinned|send_notification|used|privacy_showemail|hide_email|is_blocked|is_business_owner|onboarding_completed|is_verified|is_online)\s*=\s*([01])\b/gi,
    (match, column, value) => column + ' = ' + (value === '1' ? 'TRUE' : 'FALSE')
  );

  let output = '';
  const values = [];
  let paramIndex = 0;
  let state = 'normal';

  function appendParameter(value) {
    let finalValue = value;
    const context = output.slice(-100);
    const columnMatch = context.match(/(?:^|[.\s])("?[\w]+"?)\s*(?:=|<>|!=)\s*$/i);
    if (columnMatch) {
      const column = columnMatch[1].replace(/"/g, '').toLowerCase();
      if (BOOLEAN_COLUMNS.has(column) && (value === 0 || value === 1 || value === '0' || value === '1')) {
        finalValue = value === 1 || value === '1';
      }
    }
    values.push(finalValue === undefined ? null : finalValue);
    return '$' + values.length;
  }

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (state === 'normal') {
      if (char === "'") {
        state = 'single';
        output += char;
      } else if (char === '"') {
        state = 'identifier';
        output += char;
      } else if (char === '-' && next === '-') {
        state = 'line-comment';
        output += '--';
        i += 1;
      } else if (char === '/' && next === '*') {
        state = 'block-comment';
        output += '/*';
        i += 1;
      } else if (char === '?') {
        if (paramIndex >= params.length) {
          throw new Error('A consulta tem mais placeholders (?) do que parâmetros.');
        }

        const value = params[paramIndex++];
        const tail = sql.slice(i + 1);
        if (Array.isArray(value) && /\bIN\s*\(\s*$/i.test(output) && /^\s*\)/.test(tail)) {
          if (value.length === 0) {
            output += 'NULL';
          } else {
            output += value.map(appendParameter).join(', ');
          }
        } else if (
          Array.isArray(value) &&
          Array.isArray(value[0]) &&
          /\bVALUES\s*$/i.test(output)
        ) {
          output += value.map((row) => {
            if (!Array.isArray(row)) throw new TypeError('Lote VALUES precisa conter linhas em formato de array.');
            return '(' + row.map(appendParameter).join(', ') + ')';
          }).join(', ');
        } else {
          output += appendParameter(value);
        }
      } else {
        output += char;
      }
      continue;
    }

    if (state === 'line-comment') {
      output += char;
      if (char === '\n') state = 'normal';
      continue;
    }

    if (state === 'block-comment') {
      output += char;
      if (char === '*' && next === '/') {
        output += '/';
        i += 1;
        state = 'normal';
      }
      continue;
    }

    if (state === 'single') {
      output += char;
      if (char === "'" && next === "'") {
        output += next;
        i += 1;
      } else if (char === "'" && sql[i - 1] !== '\\') {
        state = 'normal';
      }
      continue;
    }

    if (state === 'identifier') {
      output += char;
      if (char === '"' && next === '"') {
        output += next;
        i += 1;
      } else if (char === '"') {
        state = 'normal';
      }
    }
  }

  if (paramIndex < params.length) {
    throw new Error(
      'A consulta utilizou ' + paramIndex + ' parâmetro(s), mas recebeu ' +
      params.length + '. Confira placeholders e parâmetros.'
    );
  }

  sql = output.replace(/^\s*([\s\S]*?)\s*;?\s*$/, '$1').trim();

  const limitOffset = sql.match(/\bLIMIT\s+(\$\d+)\s*,\s*(\$\d+)/i);
  if (limitOffset) {
    sql = sql.replace(limitOffset[0], 'LIMIT ' + limitOffset[2] + ' OFFSET ' + limitOffset[1]);
  }

  if (ignoreConflicts && !/\bON\s+CONFLICT\b/i.test(sql)) {
    const returningAt = sql.search(/\bRETURNING\b/i);
    if (returningAt >= 0) {
      sql = sql.slice(0, returningAt).trimEnd() + ' ON CONFLICT DO NOTHING ' + sql.slice(returningAt);
    } else {
      sql += ' ON CONFLICT DO NOTHING';
    }
  }

  const isInsert = /^\s*INSERT\b/i.test(sql);
  const hasReturning = /\bRETURNING\b/i.test(sql);
  if (isInsert && insertTable && IDENTITY_TABLES.has(insertTable) && !hasReturning) {
    sql += ' RETURNING id';
  }

  return { text: sql, values, command: isInsert ? 'INSERT' : sql.split(/\s+/)[0].toUpperCase() };
}

function makeQueryHandler(client) {
  return async function query(queryText, queryParams) {
    const prepared = translateQuery(queryText, queryParams || []);
    const result = await client.unsafe(prepared.text, prepared.values);
    const affectedRows = typeof result.count === 'number' ? result.count : result.length;

    if (prepared.command === 'SELECT' || prepared.command === 'WITH') {
      return [result];
    }

    if (prepared.command === 'INSERT') {
      const first = result[0] || {};
      return [{
        insertId: first.id === undefined ? undefined : first.id,
        affectedRows,
        rows: result
      }];
    }

    return [{ affectedRows, rows: result }];
  };
}

const db = {
  query: (...args) => makeQueryHandler(getSqlClient())(...args),

  getConnection: async () => {
    const connection = await getSqlClient().reserve();
    const query = makeQueryHandler(connection);
    return {
      query,
      beginTransaction: () => connection.unsafe('BEGIN'),
      commit: () => connection.unsafe('COMMIT'),
      rollback: () => connection.unsafe('ROLLBACK'),
      release: () => connection.release()
    };
  },

  end: async () => {
    if (sqlClient) {
      const client = sqlClient;
      sqlClient = null;
      await client.end({ timeout: 5 });
    }
  },

  __private: { translateQuery, IDENTITY_TABLES, BOOLEAN_COLUMNS }
};

module.exports = db;
