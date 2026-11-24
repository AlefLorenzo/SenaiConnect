const db = require('../db');
const { filterUserProfile } = require('../utils/privacyHelper');

const followController = {
    followUser: async (req, res) => {
        try {
            const userId = Number(req.user?.id);
            const followedId = Number(req.params.id);

            // IDs inválidos são rejeitados antes de qualquer consulta ou gravação.
            if (!Number.isSafeInteger(userId) || userId <= 0
                || !Number.isSafeInteger(followedId) || followedId <= 0) {
                return res.status(400).json({ error: 'Identificador de usuário inválido.' });
            }

            // Auto-seguimento não é permitido, mesmo se o cliente tentar chamar a API diretamente.
            if (userId === followedId) {
                return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' });
            }

            // Check if target user exists and is not private (or user is professor)
            const [targetUser] = await db.query('SELECT id, privacy_showProfile, role FROM users WHERE id = ?', [followedId]);
            if (targetUser.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            // Check if viewer can see target's profile (to follow)
            const [viewer] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
            const viewerRole = viewer.length > 0 ? viewer[0].role : 'aluno';
            targetUser[0].viewerRole = viewerRole;

            const filtered = filterUserProfile(targetUser[0], userId);
            if (filtered._privacy?.restricted) {
                return res.status(403).json({ error: 'Não é possível seguir este usuário (perfil privado).' });
            }

            const [existing] = await db.query('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?', [userId, followedId]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Você já segue este usuário.' });
            }

            await db.query('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)', [userId, followedId]);

            // Envia notificação - Activity Center format
            const notificationController = require('./notificationController');
            await notificationController.createNotification(
                followedId,
                'follow',
                userId,
                'começou a seguir você.',
                'user',
                userId,
                null,
                { action: 'follow' }
            );

            const socketHelper = require('../socketHelper');
            socketHelper.sendToUser(parseInt(followedId), 'new_follower', { followerId: userId });

            res.status(200).json({ message: 'Seguindo com sucesso.' });
        } catch (error) {
            console.error('Erro ao seguir:', error);
            res.status(500).json({ error: 'Erro ao seguir usuário.' });
        }
    },

    unfollowUser: async (req, res) => {
        try {
            const userId = req.user.id;
            const followedId = req.params.id;

            await db.query('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?', [userId, followedId]);
            res.status(200).json({ message: 'Deixou de seguir com sucesso.' });
        } catch (error) {
            console.error('Erro ao deixar de seguir:', error);
            res.status(500).json({ error: 'Erro ao deixar de seguir usuário.' });
        }
    },

    getStats: async (req, res) => {
        try {
            const { id } = req.params;
            const viewerId = req.user?.id || null;
            const targetId = parseInt(id);

            // Check if viewer can see target's profile
            if (viewerId !== targetId) {
                const [targetUser] = await db.query('SELECT privacy_showProfile, role FROM users WHERE id = ?', [targetId]);
                if (targetUser.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

                const [viewer] = await db.query('SELECT role FROM users WHERE id = ?', [viewerId]);
                const viewerRole = viewer.length > 0 ? viewer[0].role : 'aluno';
                targetUser[0].viewerRole = viewerRole;

                const { filterUserProfile } = require('../utils/privacyHelper');
                const filtered = filterUserProfile(targetUser[0], viewerId);
                if (filtered._privacy?.restricted) {
                    return res.status(403).json({ error: 'Perfil privado - estatísticas não visíveis.' });
                }
            }

            const [followersRes] = await db.query('SELECT COUNT(*) as count FROM follows WHERE followed_id = ?', [targetId]);
            const [followingRes] = await db.query('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [targetId]);

            res.status(200).json({
                followers: followersRes[0].count,
                following: followingRes[0].count
            });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar estatísticas' });
        }
    },

    checkFollowStatus: async (req, res) => {
        try {
            const userId = req.user.id;
            const targetId = req.params.id;

            const [followsRes] = await db.query('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?', [userId, targetId]);

            res.status(200).json({
                isFollowing: followsRes.length > 0
            });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao checar status' });
        }
    },

    // Helper utilizado por outros controllers (ex: messages)
    isFollowing: async (followerId, followedId) => {
        const [res] = await db.query('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?', [followerId, followedId]);
        return res.length > 0;
    }
};

module.exports = followController;