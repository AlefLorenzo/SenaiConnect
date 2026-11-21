const db = require('../db');
const { buildPrivacyWhereClause, buildEmailSelectClause, buildProfileVisibilityClause } = require('../utils/privacyHelper');

const searchController = {
    search: async (req, res) => {
        try {
            const { q, type } = req.query;
            const userId = req.user.id;

            if (!q || q.trim().length < 2) {
                return res.status(400).json({ error: 'Digite pelo menos 2 caracteres para buscar.' });
            }

            const term = `%${q.trim()}%`;
            const results = {};

            // Search users - with privacy filtering
            if (!type || type === 'users') {
                const [users] = await db.query(
                    `SELECT u.id, u.name, u.avatar, u.role, u.bio, u.course, u.unit,
                     ${buildEmailSelectClause(userId, 'u')},
                     ${buildProfileVisibilityClause(userId, 'u')},
                     EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = u.id) as is_following
                     FROM users u
                     WHERE u.id != ?
                     AND (u.name LIKE ? OR u.course LIKE ? OR u.unit LIKE ?)
                     AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = u.id)
                     AND ${buildPrivacyWhereClause(userId, 'u')}
                     ORDER BY
                       CASE WHEN u.name LIKE ? THEN 0 ELSE 1 END,
                       u.name ASC
                     LIMIT 15`,
                    [userId, userId, term, term, term, userId, `${q.trim()}%`]
                );
                results.users = users;
            }

            // Search posts - with privacy filtering
            if (!type || type === 'posts') {
                const [posts] = await db.query(
                    `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                     ${buildEmailSelectClause(userId, 'u')},
                     ${buildProfileVisibilityClause(userId, 'u')},
                     (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                     (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                     EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked
                     FROM posts p
                     JOIN users u ON p.user_id = u.id
                     WHERE p.deleted_at IS NULL
                     AND (p.content LIKE ? OR p.category LIKE ? OR p.post_type LIKE ?)
                     AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = p.user_id)
                     AND ${buildPrivacyWhereClause(userId, 'u')}
                     ORDER BY p.created_at DESC
                     LIMIT 10`,
                    [userId, term, term, term, userId]
                );
                results.posts = posts;
            }

            res.status(200).json(results);
        } catch (error) {
            console.error('Erro na busca:', error);
            res.status(500).json({ error: 'Erro ao realizar busca.' });
        }
    },

    // Suggestions for "Explorar" — SENAI context-aware
    getSuggestions: async (req, res) => {
        try {
            const userId = req.user.id;

            // Get current user profile for context
            const [[me]] = await db.query('SELECT course, unit FROM users WHERE id = ?', [userId]);

            // People you might know (same course/unit, not yet following) - with privacy
            const [people] = await db.query(
                `SELECT u.id, u.name, u.avatar, u.role, u.bio, u.course, u.unit, u.is_online,
                 ${buildEmailSelectClause(userId, 'u')},
                 ${buildProfileVisibilityClause(userId, 'u')},
                 EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = u.id) as is_following,
                 (SELECT COUNT(*) FROM follows WHERE followed_id = u.id) as followers_count
                 FROM users u
                 WHERE u.id != ?
                 AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = u.id)
                 AND ${buildPrivacyWhereClause(userId, 'u')}
                 ORDER BY
                   CASE
                     WHEN u.course = ? AND u.unit = ? THEN 0
                     WHEN u.course = ? THEN 1
                     WHEN u.unit = ? THEN 2
                     WHEN u.role = 'Professor' THEN 3
                     ELSE 4
                   END,
                   followers_count DESC
                 `,
                [userId, userId, userId, me?.course || '', me?.unit || '', me?.course || '', me?.unit || '']
            );

            // Featured projects (post_type = 'project', recent with engagement) - with privacy
            const [projects] = await db.query(
                `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                 ${buildEmailSelectClause(userId, 'u')},
                 ${buildProfileVisibilityClause(userId, 'u')},
                 (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                 (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                 EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked
                 FROM posts p
                 JOIN users u ON p.user_id = u.id
                 WHERE p.post_type = 'project' AND p.deleted_at IS NULL
                 AND ${buildPrivacyWhereClause(userId, 'u')}
                 ORDER BY (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) DESC, p.created_at DESC
                 LIMIT 5`,
                [userId]
            );

            // Open opportunities - with privacy
            const [opportunities] = await db.query(
                `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                 ${buildEmailSelectClause(userId, 'u')},
                 ${buildProfileVisibilityClause(userId, 'u')},
                 (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                 (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                 EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked
                 FROM posts p
                 JOIN users u ON p.user_id = u.id
                 WHERE p.post_type = 'opportunity' AND p.deleted_at IS NULL
                 AND ${buildPrivacyWhereClause(userId, 'u')}
                 ORDER BY p.created_at DESC
                 LIMIT 5`,
                [userId]
            );

            // Unanswered questions - with privacy
            const [questions] = await db.query(
                `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                 ${buildEmailSelectClause(userId, 'u')},
                 ${buildProfileVisibilityClause(userId, 'u')},
                 0 as likes_count, 0 as comments_count, 0 as liked
                 FROM posts p
                 JOIN users u ON p.user_id = u.id
                 WHERE p.post_type = 'question' AND p.deleted_at IS NULL
                 AND (SELECT COUNT(*) FROM comments WHERE post_id = p.id) = 0
                 AND ${buildPrivacyWhereClause(userId, 'u')}
                 ORDER BY p.created_at DESC
                 LIMIT 5`,
                []
            );

            res.status(200).json({ people, projects, opportunities, questions });
        } catch (error) {
            console.error('Erro ao buscar sugestões:', error);
            res.status(500).json({ error: 'Erro ao buscar sugestões.' });
        }
    },

    // Panel suggestions (right panel) — real data
    getPanelData: async (req, res) => {
        try {
            const userId = req.user.id;
            const [[me]] = await db.query('SELECT course, unit FROM users WHERE id = ?', [userId]);

            // Recent notices
            const [notices] = await db.query(
                `SELECT id, title, created_at FROM notices ORDER BY created_at DESC LIMIT 3`
            );

            // People to follow (not yet following, same context) - with privacy
            const [peopleToFollow] = await db.query(
                `SELECT u.id, u.name, u.avatar, u.role, u.course,
                 ${buildEmailSelectClause(userId, 'u')},
                 ${buildProfileVisibilityClause(userId, 'u')}
                 FROM users u
                 WHERE u.id != ?
                 AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = u.id)
                 AND ${buildPrivacyWhereClause(userId, 'u')}
                 ORDER BY
                   CASE WHEN u.course = ? THEN 0 WHEN u.unit = ? THEN 1 WHEN u.role = 'Professor' THEN 2 ELSE 3 END
                 LIMIT 4`,
                [userId, userId, me?.course || '', me?.unit || '']
            );

            // Suggested groups (not member)
            const [groups] = await db.query(
                `SELECT g.id, g.name, g.icon, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count
                 FROM groups_table g
                 WHERE NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?)
                 ORDER BY members_count DESC
                 LIMIT 3`,
                [userId]
            );

            res.status(200).json({ notices, peopleToFollow, groups });
        } catch (error) {
            console.error('Erro no panel:', error);
            res.status(500).json({ error: 'Erro ao buscar dados do painel.' });
        }
    }
};

module.exports = searchController;