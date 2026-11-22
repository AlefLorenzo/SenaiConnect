'use strict';

const {
  buildNoticeVisibilityClause,
  buildUnitVisibilityClause,
  normalizePublicationStatus
} = require('../utils/contentVisibility');

describe('administrative content visibility rules', () => {
  test('limits all-recipient notices to student profiles and adds selected audiences', () => {
    const result = buildNoticeVisibilityClause({
      role: 'Aluno',
      course: 'Desenvolvimento de Sistemas',
      unit: 'SENAI Alagoinhas'
    });

    expect(result.params).toEqual([
      'Aluno',
      'Desenvolvimento de Sistemas',
      'SENAI Alagoinhas'
    ]);
    expect(result.sql).toContain("LOWER(COALESCE(?, 'aluno')) IN ('aluno', 'student', 'estudante')");
    expect(result.sql).toContain("->>'type' = 'courses'");
    expect(result.sql).toContain("->>'type' = 'units'");
    expect(result.sql).toContain('jsonb_array_elements_text');
  });

  test('allows teacher and admin audiences only for matching roles', () => {
    const teacher = buildNoticeVisibilityClause({ role: 'Professor' });
    const admin = buildNoticeVisibilityClause({ role: 'Aluno', admin_role: 'super_admin' });

    expect(teacher.sql).toContain("->>'type' = 'teachers'");
    expect(teacher.params).toEqual(['Professor']);
    expect(admin.sql).toContain("->>'type' = 'admins'");
  });

  test('rejects unsafe SQL aliases', () => {
    expect(() => buildNoticeVisibilityClause({}, 'n; DROP TABLE notices')).toThrow('Invalid SQL table alias');
    expect(() => buildUnitVisibilityClause({}, 'e WHERE 1=1')).toThrow('Invalid SQL table alias');
  });

  test('shows global course/event content to users without a unit only', () => {
    expect(buildUnitVisibilityClause({}).sql).toBe("(c.unit IS NULL OR TRIM(c.unit) = '')");
    expect(buildUnitVisibilityClause({ unit: 'SENAI Alagoinhas' })).toEqual({
      sql: "(c.unit IS NULL OR TRIM(c.unit) = '' OR LOWER(TRIM(c.unit)) = LOWER(TRIM(?)))",
      params: ['SENAI Alagoinhas']
    });
    expect(buildUnitVisibilityClause({ admin_role: 'super_admin' })).toEqual({
      sql: 'TRUE',
      params: []
    });
  });

  test('normalizes admin publication status and rejects unsupported values', () => {
    expect(normalizePublicationStatus('active')).toBe('ativo');
    expect(normalizePublicationStatus('published')).toBe('ativo');
    expect(normalizePublicationStatus('draft')).toBe('rascunho');
    expect(normalizePublicationStatus('archived')).toBe('arquivado');
    expect(() => normalizePublicationStatus('public')).toThrow('Status de publicação inválido.');
  });
});
