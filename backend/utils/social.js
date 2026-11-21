const db = require('../db');

const blockedSql = (userCol) =>
  `NOT EXISTS (
     SELECT 1 FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ${userCol})
        OR (blocker_id = ${userCol} AND blocked_id = ?)
   )`;

const mutedSql = (userCol) =>
  `NOT EXISTS (SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ${userCol})`;

async function isBlockedEitherWay(userA, userB) {
  const [rows] = await db.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [userA, userB, userB, userA]
  );
  return rows.length > 0;
}

async function isMuted(muterId, mutedId) {
  const [rows] = await db.query(
    'SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ? LIMIT 1',
    [muterId, mutedId]
  );
  return rows.length > 0;
}

function extractHashtags(text) {
  if (!text) return [];
  const matches = String(text).match(/#[\p{L}\p{N}_]+/gu) || [];
  const unique = [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
  return unique.filter((t) => t.length >= 2 && t.length <= 40);
}

async function syncHashtags(postId, content) {
  const tags = extractHashtags(content);
  await db.query('DELETE FROM post_hashtags WHERE post_id = ?', [postId]);
  for (const tag of tags) {
    await db.query(
      'INSERT INTO hashtags (tag, usage_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE usage_count = usage_count + 1',
      [tag]
    );
    const [rows] = await db.query('SELECT id FROM hashtags WHERE tag = ?', [tag]);
    if (rows[0]) {
      await db.query(
        'INSERT IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)',
        [postId, rows[0].id]
      );
    }
  }
}

function renderContentWithTags(content) {
  return content || '';
}

module.exports = {
  blockedSql,
  mutedSql,
  isBlockedEitherWay,
  isMuted,
  extractHashtags,
  syncHashtags,
  renderContentWithTags,
};
