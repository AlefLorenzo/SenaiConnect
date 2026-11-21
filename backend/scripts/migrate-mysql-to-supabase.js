'use strict';

require('dotenv').config();

const mysql = require('mysql2/promise');
const postgres = require('postgres');

const PAGE_SIZE = 500;
const OMIT_COLUMNS = {
  users: new Set(['password_hash', 'auth_user_id'])
};
const SYSTEM_TABLES = new Set([
  'migrations', 'schema_migrations', '_prisma_migrations',
  'typeorm_migrations', 'knex_migrations'
]);

function quotePg(identifier) {
  return '"' + String(identifier).replace(/"/g, '""') + '"';
}

function parseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return value;
  }
}

function normalizeValue(value, column) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (column.data_type === 'boolean') {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    throw new Error('Valor booleano inválido na coluna ' + column.column_name + ': ' + String(value));
  }

  if (column.data_type === 'json' || column.data_type === 'jsonb') {
    const parsed = parseJson(value);
    return JSON.stringify(parsed);
  }

  return value;
}

function normalizeLegacySetting(row) {
  const type = String(row.type || 'string').toLowerCase();
  const raw = row.value;

  if (type === 'boolean') {
    return raw === true || raw === 1 || raw === '1' || String(raw).toLowerCase() === 'true';
  }
  if (type === 'number') {
    const number = Number(raw);
    if (!Number.isFinite(number)) throw new Error('Configuração numérica inválida: ' + row.key);
    return number;
  }
  if (type === 'json') {
    return parseJson(raw);
  }
  return raw === null || raw === undefined ? null : String(raw);
}

function mapSourceColumn(tableName, sourceRow, targetColumn) {
  if (tableName === 'system_settings') {
    if (targetColumn === 'setting_key') return sourceRow.key;
    if (targetColumn === 'setting_value') return JSON.stringify(normalizeLegacySetting(sourceRow));
    if (targetColumn === 'description') return sourceRow.description || null;
    if (targetColumn === 'updated_by') return sourceRow.updated_by || null;
    if (targetColumn === 'updated_at') return sourceRow.updated_at || null;
    return undefined;
  }

  if (tableName === 'users' && OMIT_COLUMNS.users.has(targetColumn)) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(sourceRow, targetColumn)) {
    return sourceRow[targetColumn];
  }
  const legacyColumn = Object.keys(sourceRow).find(
    (name) => name.toLowerCase() === targetColumn.toLowerCase()
  );
  return legacyColumn ? sourceRow[legacyColumn] : undefined;
}

function buildCopyPlan(tables, foreignKeys) {
  const tableNames = new Set(tables);
  const activeEdges = foreignKeys.filter((fk) =>
    tableNames.has(fk.table_name) && tableNames.has(fk.foreign_table_name)
  );
  const deferred = new Map();

  for (const fk of activeEdges) {
    if (fk.table_name === fk.foreign_table_name && fk.is_nullable === 'YES') {
      deferred.set(fk.table_name + '.' + fk.column_name, fk);
    }
  }

  while (true) {
    const omitted = new Set(deferred.keys());
    const dependencies = new Map(tables.map((name) => [name, new Set()]));
    const children = new Map(tables.map((name) => [name, new Set()]));

    for (const fk of activeEdges) {
      if (omitted.has(fk.table_name + '.' + fk.column_name)) continue;
      if (fk.table_name === fk.foreign_table_name) continue;
      dependencies.get(fk.table_name).add(fk.foreign_table_name);
      children.get(fk.foreign_table_name).add(fk.table_name);
    }

    const queue = tables.filter((name) => dependencies.get(name).size === 0).sort();
    const ordered = [];

    while (queue.length) {
      const parent = queue.shift();
      ordered.push(parent);

      for (const child of children.get(parent)) {
        dependencies.get(child).delete(parent);
        if (dependencies.get(child).size === 0 && !ordered.includes(child) && !queue.includes(child)) {
          queue.push(child);
        }
      }
    }

    if (ordered.length === tables.length) {
      return { ordered, deferredFks: Array.from(deferred.values()) };
    }

    const remaining = new Set(tables.filter((name) => !ordered.includes(name)));
    const nullableCycleEdge = activeEdges.find((fk) =>
      remaining.has(fk.table_name) &&
      remaining.has(fk.foreign_table_name) &&
      fk.is_nullable === 'YES' &&
      !deferred.has(fk.table_name + '.' + fk.column_name)
    );

    if (!nullableCycleEdge) {
      throw new Error(
        'O esquema possui ciclo de chaves estrangeiras sem coluna anulável para importação segura. ' +
        'Nenhuma tabela foi alterada. Revise as FKs do Supabase antes de continuar.'
      );
    }

    deferred.set(nullableCycleEdge.table_name + '.' + nullableCycleEdge.column_name, nullableCycleEdge);
  }
}

async function inspectSource(connection) {
  const [tables] = await connection.query(
    "SELECT TABLE_NAME AS table_name FROM information_schema.tables " +
    "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  const [columns] = await connection.query(
    "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, ORDINAL_POSITION AS ordinal_position " +
    "FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION"
  );
  const [primaryKeys] = await connection.query(
    "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, ORDINAL_POSITION AS ordinal_position " +
    "FROM information_schema.key_column_usage WHERE table_schema = DATABASE() " +
    "AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY TABLE_NAME, ORDINAL_POSITION"
  );

  const columnsByTable = new Map();
  for (const column of columns) {
    if (!columnsByTable.has(column.table_name)) columnsByTable.set(column.table_name, []);
    columnsByTable.get(column.table_name).push(column.column_name);
  }

  const primaryKeysByTable = new Map();
  for (const key of primaryKeys) {
    if (!primaryKeysByTable.has(key.table_name)) primaryKeysByTable.set(key.table_name, []);
    primaryKeysByTable.get(key.table_name).push(key.column_name);
  }

  return {
    tables: tables.map((row) => row.table_name).filter((name) => !SYSTEM_TABLES.has(name)),
    columnsByTable,
    primaryKeysByTable
  };
}

async function inspectTarget(sql) {
  const [tables, foreignKeys, primaryKeys] = await Promise.all([
    sql.unsafe(
      "SELECT table_name FROM information_schema.tables " +
      "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name"
    ),
    sql.unsafe(
      "SELECT kcu.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, " +
      "cols.is_nullable " +
      "FROM information_schema.table_constraints tc " +
      "JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name " +
      "AND tc.constraint_schema = kcu.constraint_schema " +
      "JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name " +
      "AND ccu.constraint_schema = tc.constraint_schema " +
      "JOIN information_schema.columns cols ON cols.table_schema = kcu.table_schema " +
      "AND cols.table_name = kcu.table_name AND cols.column_name = kcu.column_name " +
      "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_schema = current_schema()"
    ),
    sql.unsafe(
      "SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc " +
      "JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name " +
      "AND tc.constraint_schema = kcu.constraint_schema " +
      "WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.constraint_schema = current_schema() " +
      "ORDER BY tc.table_name, kcu.ordinal_position"
    )
  ]);

  const tableNames = tables.map((row) => row.table_name);
  const primaryKeysByTable = new Map();
  for (const key of primaryKeys) {
    if (!primaryKeysByTable.has(key.table_name)) primaryKeysByTable.set(key.table_name, []);
    primaryKeysByTable.get(key.table_name).push(key.column_name);
  }

  const columnRows = await sql.unsafe(
    "SELECT table_name, column_name, data_type, is_nullable, column_default, is_identity, ordinal_position " +
    "FROM information_schema.columns WHERE table_schema = current_schema() " +
    "ORDER BY table_name, ordinal_position"
  );

  const columnsByTable = new Map();
  for (const column of columnRows) {
    if (!columnsByTable.has(column.table_name)) columnsByTable.set(column.table_name, []);
    columnsByTable.get(column.table_name).push(column);
  }

  return {
    tables: tableNames,
    columnsByTable,
    primaryKeysByTable,
    foreignKeys
  };
}

async function getRowCount(sql, tableName) {
  const result = await sql.unsafe(
    'SELECT COUNT(*)::bigint AS count FROM ' + quotePg(tableName)
  );
  return Number(result[0].count);
}

async function readSourcePage(connection, tableName, primaryKeys, offset) {
  const orderBy = primaryKeys && primaryKeys.length
    ? ' ORDER BY ' + primaryKeys.map((key) => connection.escapeId(key)).join(', ')
    : '';
  const query = 'SELECT * FROM ' + connection.escapeId(tableName) +
    orderBy + ' LIMIT ? OFFSET ?';
  const [rows] = await connection.query(query, [PAGE_SIZE, offset]);
  return rows;
}

async function countSourceRows(connection, tableName) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) AS count FROM ' + connection.escapeId(tableName)
  );
  return Number(rows[0].count);
}

async function preparePlan(source, target, sql) {
  const matchingTables = source.tables.filter((name) =>
    target.tables.includes(name) &&
    target.columnsByTable.has(name)
  );

  const plan = buildCopyPlan(matchingTables, target.foreignKeys);
  const manifest = [];

  for (const tableName of plan.ordered) {
    const sourceColumns = new Set(source.columnsByTable.get(tableName) || []);
    const targetColumns = target.columnsByTable.get(tableName) || [];
    const omissions = OMIT_COLUMNS[tableName] || new Set();
    const insertColumns = targetColumns.filter((column) =>
      (sourceColumns.has(column.column_name) ||
        (tableName === 'system_settings' && ['setting_key', 'setting_value'].includes(column.column_name))) &&
      !omissions.has(column.column_name) &&
      !plan.deferredFks.some((fk) => fk.table_name === tableName && fk.column_name === column.column_name)
    );

    if (tableName === 'system_settings') {
      for (const required of ['setting_key', 'setting_value']) {
        if (!insertColumns.some((column) => column.column_name === required)) {
          const mappedExists = targetColumns.some((column) => column.column_name === required);
          if (!mappedExists) throw new Error('Coluna ' + required + ' ausente em public.system_settings.');
        }
      }
    }

    const insertNames = new Set(insertColumns.map((column) => column.column_name));
    const missingRequired = targetColumns.filter((column) =>
      column.is_nullable === 'NO' &&
      !column.column_default &&
      column.is_identity !== 'YES' &&
      !insertNames.has(column.column_name) &&
      !(tableName === 'system_settings' && ['setting_key', 'setting_value'].includes(column.column_name))
    );

    if (missingRequired.length) {
      throw new Error(
        'Não é possível copiar ' + tableName + ': colunas obrigatórias sem valor ou padrão: ' +
        missingRequired.map((column) => column.column_name).join(', ')
      );
    }

    const sourceCount = await countSourceRows(connection, tableName);
    const targetCount = await getRowCount(sql, tableName);
    const mappedSourceNames = new Set(insertColumns.map((column) => {
      if (tableName === 'system_settings' && column.column_name === 'setting_key') return 'key';
      if (tableName === 'system_settings' && column.column_name === 'setting_value') return 'value';
      return column.column_name;
    }));
    if (tableName === 'system_settings') mappedSourceNames.add('type');

    const unmappedColumns = (source.columnsByTable.get(tableName) || []).filter((column) =>
      !mappedSourceNames.has(column) &&
      !(OMIT_COLUMNS[tableName] && OMIT_COLUMNS[tableName].has(column))
    );

    manifest.push({
      table: tableName,
      unmappedColumns,
      sourceRows: sourceCount,
      targetRows: targetCount,
      insertColumns,
      primaryKeys: target.primaryKeysByTable.get(tableName) || [],
      deferredFks: plan.deferredFks.filter((fk) => fk.table_name === tableName)
    });
  }

  return { manifest, ordered: plan.ordered, deferredFks: plan.deferredFks };
}

async function insertBatch(tx, tablePlan, sourceRows) {
  if (!sourceRows.length) return;

  const tableName = tablePlan.table;
  const colNames = tablePlan.insertColumns.map((column) => column.column_name);

  if (!colNames.length) {
    throw new Error('Nenhuma coluna compatível para importar a tabela ' + tableName + '.');
  }

  const values = [];
  const tuples = [];

  for (const sourceRow of sourceRows) {
    const row = {};
    for (const column of tablePlan.insertColumns) {
      let value = mapSourceColumn(tableName, sourceRow, column.column_name);
      if (value === undefined) continue;

      if (tableName === 'system_settings' && column.column_name === 'setting_value') {
        row[column.column_name] = value;
      } else {
        row[column.column_name] = normalizeValue(value, column);
      }
    }

    tuples.push('(' + colNames.map((columnName) => {
      values.push(Object.prototype.hasOwnProperty.call(row, columnName) ? row[columnName] : null);
      return '
    }).join(', ') + ')');
  }

  const hasIdentity = tablePlan.insertColumns.some((column) => column.is_identity === 'YES');
  const statement = 'INSERT INTO ' + quotePg(tableName) +
    ' (' + colNames.map(quotePg).join(', ') + ')' +
    (hasIdentity ? ' OVERRIDING SYSTEM VALUE' : '') +
    ' VALUES ' + tuples.join(', ');

  await tx.unsafe(statement, values);
}

async function restoreDeferredForeignKeys(tx, sourceConnection, source, target, deferredFks) {
  const grouped = new Map();
  for (const fk of deferredFks) {
    if (!grouped.has(fk.table_name)) grouped.set(fk.table_name, []);
    grouped.get(fk.table_name).push(fk.column_name);
  }

  for (const [tableName, columns] of grouped) {
    const primaryKeys = target.primaryKeysByTable.get(tableName) || [];
    if (!primaryKeys.length) {
      throw new Error('Não há chave primária para restaurar referências adiadas em ' + tableName + '.');
    }

    const targetColumns = new Set((target.columnsByTable.get(tableName) || []).map((c) => c.column_name));
    const sourceColumns = new Set(source.columnsByTable.get(tableName) || []);
    const restorable = columns.filter((column) => targetColumns.has(column) && sourceColumns.has(column));
    if (!restorable.length) continue;

    let offset = 0;
    while (true) {
      const rows = await readSourcePage(sourceConnection, tableName, source.primaryKeysByTable.get(tableName), offset);
      if (!rows.length) break;

      for (const row of rows) {
        const assignments = [];
        const values = [];

        for (const column of restorable) {
          const value = row[column];
          if (value === null || value === undefined) continue;
          assignments.push(quotePg(column) + ' = $' + (values.push(value)));
        }

        if (assignments.length) {
          const where = primaryKeys.map((key) => {
            const value = row[key];
            values.push(value);
            return quotePg(key) + ' = $' + values.length;
          }).join(' AND ');

          await tx.unsafe(
            'UPDATE ' + quotePg(tableName) + ' SET ' + assignments.join(', ') + ' WHERE ' + where,
            values
          );
        }
      }

      offset += rows.length;
    }
  }
}

async function synchronizeIdentitySequences(tx, manifest) {
  for (const tablePlan of manifest) {
    const identityColumns = tablePlan.insertColumns.filter((column) => column.is_identity === 'YES');
    for (const column of identityColumns) {
      const table = quotePg(tablePlan.table);
      const field = quotePg(column.column_name);
      await tx.unsafe(
        'SELECT setval(pg_get_serial_sequence($1, $2), ' +
        'COALESCE(MAX(' + field + '), 1), MAX(' + field + ') IS NOT NULL) FROM ' + table,
        ['public.' + tablePlan.table, column.column_name]
      );
    }
  }
}

async function run() {
  const apply = process.argv.includes('--apply');
  const confirmed = process.argv.includes('--confirm-copy');

  if (apply && !confirmed) {
    throw new Error('A cópia exige as duas opções: --apply --confirm-copy.');
  }
  if (!apply) {
    console.log('MODO SIMULAÇÃO: nenhum dado será gravado. Use --apply --confirm-copy após revisar o relatório.');
  }

  const sourceConfig = {
    host: process.env.MYSQL_SOURCE_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_SOURCE_PORT || 3306),
    user: process.env.MYSQL_SOURCE_USER || 'root',
    password: process.env.MYSQL_SOURCE_PASSWORD || '',
    database: process.env.MYSQL_SOURCE_DATABASE || 'redesocial',
    waitForConnections: true,
    connectionLimit: 5,
    timezone: 'Z',
    dateStrings: false
  };

  const destinationUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!destinationUrl) throw new Error('Defina DATABASE_URL com a URI PostgreSQL de Supabase > Connect.');

  const [sourceConnection, sql] = await Promise.all([
    mysql.createConnection(sourceConfig),
    Promise.resolve(postgres(destinationUrl, {
      ssl: process.env.DB_SSL === 'disable' ? false : 'require',
      max: 1,
      connect_timeout: 15,
      prepare: false
    }))
  ]);

  try {
    const source = await inspectSource(sourceConnection);
    const target = await inspectTarget(sql);
    const plan = await preparePlan(source, target, sql);

    console.log('\nRESUMO DA SIMULAÇÃO');
    console.log('Tabelas de origem: ' + source.tables.length);
    console.log('Tabelas compatíveis para cópia: ' + plan.manifest.length);
    console.log('Referências que serão restauradas após a cópia: ' + plan.deferredFks.length);
    console.table(plan.manifest.map(({ table, sourceRows, targetRows }) => ({
      tabela: table,
      origem: sourceRows,
      destino: targetRows,
      estado: targetRows === 0 ? 'vazia' : 'NÃO VAZIA'
    })));

    const tablesWithSourceRows = plan.manifest.filter((entry) => entry.sourceRows > 0);
    const occupied = tablesWithSourceRows.filter((entry) => entry.targetRows > 0);
    if (occupied.length) {
      throw new Error(
        'Importação cancelada: as tabelas de destino já contêm dados: ' +
        occupied.map((entry) => entry.table + ' (' + entry.targetRows + ')').join(', ') +
        '. Nenhum registro foi apagado ou sobrescrito.'
      );
    }

    const unmatched = source.tables.filter((table) =>
      !target.tables.includes(table) && !SYSTEM_TABLES.has(table)
    );
    const unmatchedWithRows = [];
    for (const table of unmatched) {
      const rows = await countSourceRows(sourceConnection, table);
      if (rows > 0) unmatchedWithRows.push({ table, rows });
    }
    if (unmatchedWithRows.length) {
      console.warn('Tabelas com dados sem tabela correspondente no Supabase: ' +
        unmatchedWithRows.map((row) => row.table + ' (' + row.rows + ')').join(', '));
    }

    const unmappedData = plan.manifest
      .filter((entry) => entry.sourceRows > 0 && entry.unmappedColumns.length)
      .map((entry) => ({
        table: entry.table,
        columns: entry.unmappedColumns
      }));
    if (unmappedData.length) {
      console.warn('Colunas da origem sem destino correspondente (serão ignoradas): ' +
        unmappedData.map((entry) => entry.table + ': ' + entry.columns.join(', ')).join(' | '));
    }

    if (!apply) {
      console.log('\nSimulação concluída. Nenhuma gravação foi realizada.');
      console.log('Antes de aplicar: faça backup do MySQL, confira tabelas não correspondentes e o mapeamento de dados.');
      return;
    }

    if ((unmatchedWithRows.length || unmappedData.length) && !process.argv.includes('--allow-unmapped')) {
      throw new Error(
        'Cópia cancelada para evitar perda silenciosa de dados. Revise as tabelas/colunas sem destino e, ' +
        'somente depois, repita com --allow-unmapped para aceitar explicitamente essas omissões.'
      );
    }

    if (tablesWithSourceRows.length === 0) {
      console.log('Não há registros na origem para copiar.');
      return;
    }

    await sql.begin(async (tx) => {
      await tx.unsafe('SET CONSTRAINTS ALL DEFERRED');

      for (const tablePlan of plan.manifest) {
        if (!tablePlan.sourceRows) continue;
        console.log('Copiando ' + tablePlan.table + ' (' + tablePlan.sourceRows + ' registros)...');

        let offset = 0;
        while (true) {
          const rows = await readSourcePage(
            sourceConnection,
            tablePlan.table,
            source.primaryKeysByTable.get(tablePlan.table),
            offset
          );
          if (!rows.length) break;

          await insertBatch(tx, tablePlan, rows);
          offset += rows.length;
        }
      }

      await restoreDeferredForeignKeys(
        tx, sourceConnection, source, target, plan.deferredFks
      );
      await synchronizeIdentitySequences(tx, plan.manifest);
    });

    console.log('\nCópia concluída dentro de uma única transação.');
    console.log('Os hashes de senha antigos não foram importados para public.users. Os usuários devem ativar ou redefinir a senha via Supabase Auth.');
  } finally {
    await Promise.allSettled([sourceConnection.end(), sql.end({ timeout: 10 })]);
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('\nERRO NA MIGRAÇÃO:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCopyPlan,
  normalizeLegacySetting,
  normalizeValue,
  run
};
 + values.length + (['json', 'jsonb'].includes(tablePlan.insertColumns.find((column) => column.column_name === columnName)?.data_type) ? '::jsonb' : '');
    }).join(', ') + ')');
  }

  const hasIdentity = tablePlan.insertColumns.some((column) => column.is_identity === 'YES');
  const statement = 'INSERT INTO ' + quotePg(tableName) +
    ' (' + colNames.map(quotePg).join(', ') + ')' +
    (hasIdentity ? ' OVERRIDING SYSTEM VALUE' : '') +
    ' VALUES ' + tuples.join(', ');

  await tx.unsafe(statement, values);
}

async function restoreDeferredForeignKeys(tx, sourceConnection, source, target, deferredFks) {
  const grouped = new Map();
  for (const fk of deferredFks) {
    if (!grouped.has(fk.table_name)) grouped.set(fk.table_name, []);
    grouped.get(fk.table_name).push(fk.column_name);
  }

  for (const [tableName, columns] of grouped) {
    const primaryKeys = target.primaryKeysByTable.get(tableName) || [];
    if (!primaryKeys.length) {
      throw new Error('Não há chave primária para restaurar referências adiadas em ' + tableName + '.');
    }

    const targetColumns = new Set((target.columnsByTable.get(tableName) || []).map((c) => c.column_name));
    const sourceColumns = new Set(source.columnsByTable.get(tableName) || []);
    const restorable = columns.filter((column) => targetColumns.has(column) && sourceColumns.has(column));
    if (!restorable.length) continue;

    let offset = 0;
    while (true) {
      const rows = await readSourcePage(sourceConnection, tableName, source.primaryKeysByTable.get(tableName), offset);
      if (!rows.length) break;

      for (const row of rows) {
        const assignments = [];
        const values = [];

        for (const column of restorable) {
          const value = row[column];
          if (value === null || value === undefined) continue;
          assignments.push(quotePg(column) + ' = $' + (values.push(value)));
        }

        if (assignments.length) {
          const where = primaryKeys.map((key) => {
            const value = row[key];
            values.push(value);
            return quotePg(key) + ' = $' + values.length;
          }).join(' AND ');

          await tx.unsafe(
            'UPDATE ' + quotePg(tableName) + ' SET ' + assignments.join(', ') + ' WHERE ' + where,
            values
          );
        }
      }

      offset += rows.length;
    }
  }
}

async function synchronizeIdentitySequences(tx, manifest) {
  for (const tablePlan of manifest) {
    const identityColumns = tablePlan.insertColumns.filter((column) => column.is_identity === 'YES');
    for (const column of identityColumns) {
      const table = quotePg(tablePlan.table);
      const field = quotePg(column.column_name);
      await tx.unsafe(
        'SELECT setval(pg_get_serial_sequence($1, $2), ' +
        'COALESCE(MAX(' + field + '), 1), MAX(' + field + ') IS NOT NULL) FROM ' + table,
        ['public.' + tablePlan.table, column.column_name]
      );
    }
  }
}

async function run() {
  const apply = process.argv.includes('--apply');
  const confirmed = process.argv.includes('--confirm-copy');

  if (apply && !confirmed) {
    throw new Error('A cópia exige as duas opções: --apply --confirm-copy.');
  }
  if (!apply) {
    console.log('MODO SIMULAÇÃO: nenhum dado será gravado. Use --apply --confirm-copy após revisar o relatório.');
  }

  const sourceConfig = {
    host: process.env.MYSQL_SOURCE_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_SOURCE_PORT || 3306),
    user: process.env.MYSQL_SOURCE_USER || 'root',
    password: process.env.MYSQL_SOURCE_PASSWORD || '',
    database: process.env.MYSQL_SOURCE_DATABASE || 'redesocial',
    waitForConnections: true,
    connectionLimit: 5,
    timezone: 'Z',
    dateStrings: false
  };

  const destinationUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!destinationUrl) throw new Error('Defina DATABASE_URL com a URI PostgreSQL de Supabase > Connect.');

  const [sourceConnection, sql] = await Promise.all([
    mysql.createConnection(sourceConfig),
    Promise.resolve(postgres(destinationUrl, {
      ssl: process.env.DB_SSL === 'disable' ? false : 'require',
      max: 1,
      connect_timeout: 15,
      prepare: false
    }))
  ]);

  try {
    const source = await inspectSource(sourceConnection);
    const target = await inspectTarget(sql);
    const plan = await preparePlan(source, target, sql);

    console.log('\nRESUMO DA SIMULAÇÃO');
    console.log('Tabelas de origem: ' + source.tables.length);
    console.log('Tabelas compatíveis para cópia: ' + plan.manifest.length);
    console.log('Referências que serão restauradas após a cópia: ' + plan.deferredFks.length);
    console.table(plan.manifest.map(({ table, sourceRows, targetRows }) => ({
      tabela: table,
      origem: sourceRows,
      destino: targetRows,
      estado: targetRows === 0 ? 'vazia' : 'NÃO VAZIA'
    })));

    const tablesWithSourceRows = plan.manifest.filter((entry) => entry.sourceRows > 0);
    const occupied = tablesWithSourceRows.filter((entry) => entry.targetRows > 0);
    if (occupied.length) {
      throw new Error(
        'Importação cancelada: as tabelas de destino já contêm dados: ' +
        occupied.map((entry) => entry.table + ' (' + entry.targetRows + ')').join(', ') +
        '. Nenhum registro foi apagado ou sobrescrito.'
      );
    }

    const unmatched = source.tables.filter((table) =>
      !target.tables.includes(table) && !SYSTEM_TABLES.has(table)
    );
    const unmatchedWithRows = [];
    for (const table of unmatched) {
      const rows = await countSourceRows(sourceConnection, table);
      if (rows > 0) unmatchedWithRows.push({ table, rows });
    }
    if (unmatchedWithRows.length) {
      console.warn('Tabelas com dados sem tabela correspondente no Supabase: ' +
        unmatchedWithRows.map((row) => row.table + ' (' + row.rows + ')').join(', '));
    }

    const unmappedData = plan.manifest
      .filter((entry) => entry.sourceRows > 0 && entry.unmappedColumns.length)
      .map((entry) => ({
        table: entry.table,
        columns: entry.unmappedColumns
      }));
    if (unmappedData.length) {
      console.warn('Colunas da origem sem destino correspondente (serão ignoradas): ' +
        unmappedData.map((entry) => entry.table + ': ' + entry.columns.join(', ')).join(' | '));
    }

    if (!apply) {
      console.log('\nSimulação concluída. Nenhuma gravação foi realizada.');
      console.log('Antes de aplicar: faça backup do MySQL, confira tabelas não correspondentes e o mapeamento de dados.');
      return;
    }

    if ((unmatchedWithRows.length || unmappedData.length) && !process.argv.includes('--allow-unmapped')) {
      throw new Error(
        'Cópia cancelada para evitar perda silenciosa de dados. Revise as tabelas/colunas sem destino e, ' +
        'somente depois, repita com --allow-unmapped para aceitar explicitamente essas omissões.'
      );
    }

    if (tablesWithSourceRows.length === 0) {
      console.log('Não há registros na origem para copiar.');
      return;
    }

    await sql.begin(async (tx) => {
      await tx.unsafe('SET CONSTRAINTS ALL DEFERRED');

      for (const tablePlan of plan.manifest) {
        if (!tablePlan.sourceRows) continue;
        console.log('Copiando ' + tablePlan.table + ' (' + tablePlan.sourceRows + ' registros)...');

        let offset = 0;
        while (true) {
          const rows = await readSourcePage(
            sourceConnection,
            tablePlan.table,
            source.primaryKeysByTable.get(tablePlan.table),
            offset
          );
          if (!rows.length) break;

          await insertBatch(tx, tablePlan, rows);
          offset += rows.length;
        }
      }

      await restoreDeferredForeignKeys(
        tx, sourceConnection, source, target, plan.deferredFks
      );
      await synchronizeIdentitySequences(tx, plan.manifest);
    });

    console.log('\nCópia concluída dentro de uma única transação.');
    console.log('Os hashes de senha antigos não foram importados para public.users. Os usuários devem ativar ou redefinir a senha via Supabase Auth.');
  } finally {
    await Promise.allSettled([sourceConnection.end(), sql.end({ timeout: 10 })]);
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('\nERRO NA MIGRAÇÃO:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCopyPlan,
  normalizeLegacySetting,
  normalizeValue,
  run
};
