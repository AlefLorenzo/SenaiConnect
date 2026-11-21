const db = require('../db');
const { filterUserProfile, buildPrivacyWhereClause, buildEmailSelectClause } = require('../utils/privacyHelper');

const userController = {
    getProfile: async (req, res) => {
        try {
            const { id } = req.params;
            const viewerId = req.user?.id || null;
            const targetId = parseInt(id);

            // Get target user with privacy settings
            const [users] = await db.query(
                `SELECT id, name, email, role, avatar, bio, cover_image, state, city, unit, area, course, links, skills, created_at, xp, level, is_business_owner, privacy_showProfile, privacy_showEmail
                 FROM users WHERE id = ?`,
                [targetId]
            );

            if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            const targetUser = users[0];

            // Add viewer role for privacy check
            if (viewerId) {
                const [viewer] = await db.query('SELECT role FROM users WHERE id = ?', [viewerId]);
                targetUser.viewerRole = viewer.length > 0 ? viewer[0].role : 'aluno';
            }

            // Apply privacy filtering
            const filteredProfile = filterUserProfile(targetUser, viewerId);

            res.status(200).json(filteredProfile);
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const { id } = req.params;
            const { avatar, bio, cover_image, state, city, unit, area, course, links, privacy_showProfile, privacy_showEmail } = req.body;
            const loggedUserId = req.user.id;

            if (parseInt(id) !== loggedUserId) {
                return res.status(403).json({ error: 'Você não tem permissão para editar este perfil.' });
            }

            // Build dynamic update to avoid overwriting fields not sent
            const fields = [];
            const values = [];

            if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
            if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
            if (cover_image !== undefined) { fields.push('cover_image = ?'); values.push(cover_image); }
            if (state !== undefined) { fields.push('state = ?'); values.push(state); }
            if (city !== undefined) { fields.push('city = ?'); values.push(city); }
            if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
            if (area !== undefined) { fields.push('area = ?'); values.push(area); }
            if (course !== undefined) { fields.push('course = ?'); values.push(course); }
            if (links !== undefined) { fields.push('links = ?'); values.push(typeof links === 'object' ? JSON.stringify(links) : links); }
            if (privacy_showProfile !== undefined) { fields.push('privacy_showProfile = ?'); values.push(privacy_showProfile); }
            if (privacy_showEmail !== undefined) { fields.push('privacy_showEmail = ?'); values.push(privacy_showEmail ? 1 : 0); }

            if (fields.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            values.push(id);
            await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

            // Emit socket event to notify other connected clients about profile change
            const socketHelper = require('../socketHelper');
            socketHelper.broadcast('profile_updated', { userId: parseInt(id), fields: req.body });

            res.status(200).json({ message: 'Perfil atualizado com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            res.status(500).json({ error: 'Erro ao atualizar perfil' });
        }
    },

    getUserPosts: async (req, res) => {
        try {
            const { id } = req.params;
            const loggedUserId = req.user.id;
            const targetId = parseInt(id);

            // Check if viewer can see target's profile
            const [targetUser] = await db.query('SELECT privacy_showProfile, role FROM users WHERE id = ?', [targetId]);
            if (targetUser.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            const viewer = await db.query('SELECT role FROM users WHERE id = ?', [loggedUserId]);
            const viewerRole = viewer[0].length > 0 ? viewer[0][0].role : 'aluno';
            targetUser[0].viewerRole = viewerRole;

            const { filterUserProfile } = require('../utils/privacyHelper');
            const filtered = filterUserProfile(targetUser[0], loggedUserId);

            if (filtered._privacy?.restricted) {
                return res.status(403).json({ error: 'Perfil privado - posts não visíveis.' });
            }

            const query = `
                SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked,
                EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as saved
                FROM posts p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ? AND p.group_id IS NULL
                ORDER BY p.created_at DESC
            `;
            const [posts] = await db.query(query, [loggedUserId, loggedUserId, targetId]);
            res.status(200).json(posts);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar posts do usuário' });
        }
    },

    getUserSaved: async (req, res) => {
        try {
            const { id } = req.params;
            const loggedUserId = req.user.id;

            if (parseInt(id) !== loggedUserId) {
                return res.status(403).json({ error: 'Não autorizado a ver posts salvos de outros usuários.' });
            }

            const query = `
                SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked,
                TRUE as saved
                FROM saved_posts sp
                JOIN posts p ON sp.post_id = p.id
                JOIN users u ON p.user_id = u.id
                WHERE sp.user_id = ?
                ORDER BY sp.created_at DESC
            `;
            const [posts] = await db.query(query, [loggedUserId, id]);
            res.status(200).json(posts);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar posts salvos' });
        }
    },

    getUserGroups: async (req, res) => {
        try {
            const { id } = req.params;
            const loggedUserId = req.user.id;
            const targetId = parseInt(id);

            // Check if viewer can see target's profile (for groups visibility)
            const [targetUser] = await db.query('SELECT privacy_showProfile, role FROM users WHERE id = ?', [targetId]);
            if (targetUser.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            const [viewer] = await db.query('SELECT role FROM users WHERE id = ?', [loggedUserId]);
            const viewerRole = viewer.length > 0 ? viewer[0].role : 'aluno';
            targetUser[0].viewerRole = viewerRole;

            const { filterUserProfile } = require('../utils/privacyHelper');
            const filtered = filterUserProfile(targetUser[0], loggedUserId);

            if (filtered._privacy?.restricted) {
                return res.status(403).json({ error: 'Perfil privado - grupos não visíveis.' });
            }

            const query = `
                SELECT g.*,
                (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count
                FROM group_members gm
                JOIN groups_table g ON gm.group_id = g.id
                WHERE gm.user_id = ?
            `;
            const [groups] = await db.query(query, [targetId]);
            res.status(200).json(groups);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar grupos do usuário' });
        }
    }
};

module.exports = userController;