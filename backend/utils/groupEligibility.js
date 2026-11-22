const db = require('../db');
const { buildPrivacyWhereClause } = require('./privacyHelper');

function buildRelationshipCondition() {
    return `(
        EXISTS (
            SELECT 1 FROM messages m
            WHERE (m.sender_id = ? AND m.receiver_id = u.id)
               OR (m.sender_id = u.id AND m.receiver_id = ?)
        )
        OR EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = ? AND f.followed_id = u.id
        )
        OR EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = u.id AND f.followed_id = ?
        )
    )`;
}

async function getEligibleGroupContacts(userId) {
    const requesterId = Number(userId);
    if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
        throw new Error('Identificador de usuário inválido.');
    }

    const relationshipCondition = buildRelationshipCondition();
    const [contacts] = await db.query(`
        SELECT
            u.id,
            u.name,
            u.avatar,
            u.role,
            CASE WHEN EXISTS (
                SELECT 1 FROM messages m
                WHERE (m.sender_id = ? AND m.receiver_id = u.id)
                   OR (m.sender_id = u.id AND m.receiver_id = ?)
            ) THEN 1 ELSE 0 END AS has_conversation,
            CASE WHEN EXISTS (
                SELECT 1 FROM follows f
                WHERE f.follower_id = ? AND f.followed_id = u.id
            ) THEN 1 ELSE 0 END AS is_following,
            CASE WHEN EXISTS (
                SELECT 1 FROM follows f
                WHERE f.follower_id = u.id AND f.followed_id = ?
            ) THEN 1 ELSE 0 END AS follows_you
        FROM users u
        WHERE u.id <> ?
          AND ${relationshipCondition}
          AND ${buildPrivacyWhereClause(requesterId, 'u')}
        ORDER BY u.name ASC
    `, [
        requesterId, requesterId,
        requesterId,
        requesterId,
        requesterId,
        requesterId, requesterId, requesterId, requesterId
    ]);

    return contacts;
}

async function getEligibleGroupParticipantIds(userId, candidateIds) {
    const requesterId = Number(userId);
    const ids = [...new Set((Array.isArray(candidateIds) ? candidateIds : []).map(Number))];

    if (!Number.isSafeInteger(requesterId) || requesterId <= 0) return [];
    if (ids.length === 0 || ids.some(id => !Number.isSafeInteger(id) || id <= 0 || id === requesterId)) {
        return [];
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [eligible] = await db.query(`
        SELECT u.id
        FROM users u
        WHERE u.id IN (${placeholders})
          AND (
              EXISTS (
                  SELECT 1 FROM messages m
                  WHERE (m.sender_id = ? AND m.receiver_id = u.id)
                     OR (m.sender_id = u.id AND m.receiver_id = ?)
              )
              OR EXISTS (
                  SELECT 1 FROM follows f
                  WHERE f.follower_id = ? AND f.followed_id = u.id
              )
              OR EXISTS (
                  SELECT 1 FROM follows f
                  WHERE f.follower_id = u.id AND f.followed_id = ?
              )
          )
          AND ${buildPrivacyWhereClause(requesterId, 'u')}
    `, [
        ...ids,
        requesterId, requesterId,
        requesterId,
        requesterId
    ]);

    return eligible.map(row => Number(row.id));
}

module.exports = {
    getEligibleGroupContacts,
    getEligibleGroupParticipantIds
};
