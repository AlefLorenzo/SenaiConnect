const importer = require('../scripts/migrate-mysql-to-supabase');

describe('safe MySQL to Supabase migration helpers', () => {
  test('converts legacy boolean system settings into JSON booleans', () => {
    expect(importer.normalizeLegacySetting({ key: 'enabled', value: 'true', type: 'boolean' })).toBe(true);
    expect(importer.normalizeLegacySetting({ key: 'enabled', value: '0', type: 'boolean' })).toBe(false);
  });

  test('converts legacy numeric and JSON settings', () => {
    expect(importer.normalizeLegacySetting({ key: 'limit', value: '25', type: 'number' })).toBe(25);
    expect(importer.normalizeLegacySetting({ key: 'flags', value: '{"a":true}', type: 'json' })).toEqual({ a: true });
  });

  test('converts PostgreSQL boolean columns from MySQL integer values', () => {
    expect(importer.normalizeValue(1, { column_name: 'is_blocked', data_type: 'boolean' })).toBe(true);
    expect(importer.normalizeValue(0, { column_name: 'is_blocked', data_type: 'boolean' })).toBe(false);
  });

  test('detects and defers nullable foreign key cycles safely', () => {
    const result = importer.buildCopyPlan(
      ['businesses', 'users'],
      [
        { table_name: 'users', column_name: 'business_id', foreign_table_name: 'businesses', is_nullable: 'YES' },
        { table_name: 'businesses', column_name: 'owner_user_id', foreign_table_name: 'users', is_nullable: 'NO' }
      ]
    );

    expect(result.ordered).toHaveLength(2);
    expect(result.deferredFks).toHaveLength(1);
    expect(result.deferredFks[0].column_name).toBe('business_id');
  });

  test('rejects non-nullable foreign key cycles before a database write', () => {
    expect(() => importer.buildCopyPlan(
      ['table_a', 'table_b'],
      [
        { table_name: 'table_a', column_name: 'b_id', foreign_table_name: 'table_b', is_nullable: 'NO' },
        { table_name: 'table_b', column_name: 'a_id', foreign_table_name: 'table_a', is_nullable: 'NO' }
      ]
    )).toThrow(/ciclo de chaves estrangeiras/);
  });
});
