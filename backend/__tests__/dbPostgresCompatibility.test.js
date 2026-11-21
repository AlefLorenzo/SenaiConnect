const db = require('../db');
const { translateQuery } = db.__private;

describe('MySQL to PostgreSQL query compatibility', () => {
  test('converts placeholders, string literals and date functions', () => {
    const result = translateQuery(
      'SELECT * FROM users WHERE email = ? AND role = "Aluno" AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
      ['aluno@estudante.senai.com']
    );

    expect(result.text).toContain('email = $1');
    expect(result.text).toContain("role = 'Aluno'");
    expect(result.text).toContain("NOW() - INTERVAL '7 days'");
    expect(result.values).toEqual(['aluno@estudante.senai.com']);
  });

  test('expands array parameters used with IN (?)', () => {
    const result = translateQuery(
      'SELECT * FROM group_members WHERE user_id IN (?) AND group_id = ?',
      [[10, 20, 30], 4]
    );

    expect(result.text).toContain('user_id IN ($1, $2, $3)');
    expect(result.text).toContain('group_id = $4');
    expect(result.values).toEqual([10, 20, 30, 4]);
  });

  test('handles an empty IN list without generating invalid SQL', () => {
    const result = translateQuery(
      'SELECT * FROM users WHERE id IN (?)',
      [[]]
    );

    expect(result.text).toContain('id IN (NULL)');
    expect(result.values).toEqual([]);
  });

  test('converts boolean assignments and comparison parameters', () => {
    const result = translateQuery(
      'UPDATE users SET is_blocked = ? WHERE id = ?',
      [1, 42]
    );

    expect(result.text).toContain('is_blocked = $1');
    expect(result.values).toEqual([true, 42]);
  });

  test('converts literal boolean comparisons', () => {
    const result = translateQuery(
      'SELECT id FROM users WHERE is_blocked = 0 AND onboarding_completed = 1',
      []
    );

    expect(result.text).toContain('is_blocked = FALSE');
    expect(result.text).toContain('onboarding_completed = TRUE');
  });

  test('maps INSERT IGNORE to ON CONFLICT DO NOTHING', () => {
    const result = translateQuery(
      'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [3, 8, 'member']
    );

    expect(result.text).toContain('ON CONFLICT DO NOTHING');
    expect(result.values).toEqual([3, 8, 'member']);
  });

  test('maps known MySQL upserts and drops duplicated update placeholders', () => {
    const result = translateQuery(
      'INSERT INTO group_last_read (group_id, user_id, last_read_message_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_read_message_id = ?',
      [3, 8, 99, 99]
    );

    expect(result.text).toContain('ON CONFLICT (group_id, user_id)');
    expect(result.text).toContain('last_read_message_id = EXCLUDED.last_read_message_id');
    expect(result.values).toEqual([3, 8, 99]);
  });

  test('expands the legacy bulk VALUES ? form', () => {
    const result = translateQuery(
      'INSERT INTO highlight_stories (highlight_id, story_id) VALUES ?',
      [[[2, 11], [2, 12]]]
    );

    expect(result.text).toContain('VALUES ($1, $2), ($3, $4)');
    expect(result.values).toEqual([2, 11, 2, 12]);
  });

  test('uses RETURNING id where existing controllers expect insertId', () => {
    const result = translateQuery(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [1, 2, 'Oi']
    );

    expect(result.text).toMatch(/RETURNING id$/);
  });

  test('converts boolean values in INSERT columns using the target schema', () => {
    const result = translateQuery(
      'INSERT INTO notices (author_id, is_pinned, send_notification) VALUES (?, ?, ?)',
      [8, 1, 0]
    );

    expect(result.values).toEqual([8, true, false]);
    expect(result.text).toMatch(/RETURNING id$/);
  });

  test('converts MySQL DATE_FORMAT to PostgreSQL TO_CHAR', () => {
    const result = translateQuery(
      "SELECT DATE_FORMAT(bf.created_at, '%d/%m/%Y %H:%i') AS followed_at FROM business_followers bf",
      []
    );

    expect(result.text).toContain("TO_CHAR(bf.created_at, 'DD/MM/YYYY HH24:MI')");
  });

  test('maps group admin upsert and keeps the required assigned_by value', () => {
    const result = translateQuery(
      'INSERT INTO group_admins (group_id, admin_id, assigned_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE assigned_by = ?',
      [7, 22, 9, 9]
    );

    expect(result.text).toContain('ON CONFLICT (group_id, admin_id)');
    expect(result.text).toContain('assigned_by = EXCLUDED.assigned_by');
    expect(result.values).toEqual([7, 22, 9]);
  });

  test('returns generated identifiers for every identity table used by the schema', () => {
    const result = translateQuery(
      'INSERT INTO story_reactions (story_id, user_id, reaction) VALUES (?, ?, ?)',
      [4, 8, 'heart']
    );

    expect(result.text).toMatch(/RETURNING id$/);
  });

  test('preserves camelCase result aliases returned by legacy controllers', () => {
    const result = translateQuery(
      'SELECT COUNT(*) AS thisWeek, COUNT(*) AS "reportsReceived" FROM admin_logs',
      []
    );

    expect(result.text).toContain('AS "thisWeek"');
    expect(result.text).toContain('AS "reportsReceived"');
  });

  test('converts MySQL pagination to PostgreSQL order', () => {
    const result = translateQuery(
      'SELECT id FROM users ORDER BY id LIMIT ?, ?',
      [20, 10]
    );

    expect(result.text).toContain('LIMIT $2 OFFSET $1');
    expect(result.values).toEqual([20, 10]);
  });
});
