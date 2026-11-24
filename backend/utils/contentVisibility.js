'use strict';

/**
 * Builds the SQL predicate that decides whether an authenticated user can see
 * an administrative notice. Keep this in one place so the notice wall and the
 * admin-uploaded document library cannot drift apart.
 *
 * recipients is JSONB: { type: 'all' | 'courses' | 'units' | 'teachers' | 'admins',
 * values?: string[] }. Older rows with NULL or the JSON string "all" remain public.
 */
function buildNoticeVisibilityClause(user = {}, alias = 'n') {
  if (!/^[a-z][a-z0-9_]*$/i.test(alias)) {
    throw new TypeError('Invalid SQL table alias');
  }

  const recipients = `${alias}.recipients`;
  const values = `COALESCE(${recipients}->'values', ${recipients}->'courses', ${recipients}->'units', '[]'::jsonb)`;
  const conditions = [
    `${recipients} IS NULL`,
    `${recipients} = 'null'::jsonb`,
    `${recipients} = '"all"'::jsonb`,
    `(${recipients}->>'type' = 'all' AND LOWER(COALESCE(?, 'aluno')) IN ('aluno', 'student', 'estudante'))`
  ];
  const params = [String(user.role || 'aluno')];

  if (user.course) {
    conditions.push(
      `(${recipients}->>'type' = 'courses' AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(${values}) AS recipient_course(value)
        WHERE LOWER(TRIM(recipient_course.value)) = LOWER(TRIM(?))
      ))`
    );
    params.push(String(user.course));
  }

  if (user.unit) {
    conditions.push(
      `(${recipients}->>'type' = 'units' AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(${values}) AS recipient_unit(value)
        WHERE LOWER(TRIM(recipient_unit.value)) = LOWER(TRIM(?))
      ))`
    );
    params.push(String(user.unit));
  }

  if (['professor', 'professora', 'teacher', 'teachers', 'docente'].includes(
    String(user.role || '').trim().toLowerCase()
  )) {
    conditions.push(`${recipients}->>'type' = 'teachers'`);
  }

  if (user.admin_role) {
    conditions.push(`${recipients}->>'type' = 'admins'`);
  }

  return {
    sql: `(${conditions.join(' OR ')})`,
    params
  };
}

function buildUnitVisibilityClause(user = {}, alias = 'c') {
  if (!/^[a-z][a-z0-9_]*$/i.test(alias)) {
    throw new TypeError('Invalid SQL table alias');
  }

  if (user.admin_role === 'super_admin') return { sql: 'TRUE', params: [] };

  if (!user.unit) {
    return {
      sql: `(${alias}.unit IS NULL OR TRIM(${alias}.unit) = '')`,
      params: []
    };
  }

  return {
    sql: `(${alias}.unit IS NULL OR TRIM(${alias}.unit) = '' OR LOWER(TRIM(${alias}.unit)) = LOWER(TRIM(?)))`,
    params: [String(user.unit)]
  };
}

function normalizePublicationStatus(value, fallback = 'ativo') {
  const status = String(value || fallback).trim().toLowerCase();
  if (['ativo', 'active', 'published'].includes(status)) return 'ativo';
  if (['rascunho', 'draft', 'unpublished'].includes(status)) return 'rascunho';
  if (['arquivado', 'archived', 'inactive'].includes(status)) return 'arquivado';
  throw new TypeError('Status de publicação inválido.');
}

module.exports = { buildNoticeVisibilityClause, buildUnitVisibilityClause, normalizePublicationStatus };
