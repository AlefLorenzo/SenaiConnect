const db = require('../db');
const socketHelper = require('../socketHelper');

const businessNotificationController = {
    // Listar notificações de negócios do usuário
    getNotifications: async (req, res) => {
        try {
            const userId = req.user.id;
            const { unreadOnly, page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE bn.user_id = ?';
            const params = [userId];

            if (unreadOnly === 'true') {
                whereClause += ' AND bn.is_read = 0';
            }

            const query = `
                SELECT bn.*, b.company_name as business_name, b.logo_url as business_logo
                FROM business_notifications bn
                JOIN businesses b ON bn.source_business_id = b.id
                ${whereClause}
                ORDER BY bn.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);

            const [notifications] = await db.query(query, params);

            const countQuery = `SELECT COUNT(*) as total FROM business_notifications bn ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            const [[{ unreadCount }]] = await db.query('SELECT COUNT(*) as unreadCount FROM business_notifications WHERE user_id = ? AND is_read = 0', [userId]);

            res.json({ notifications, total, unreadCount, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
            res.status(500).json({ error: 'Erro ao buscar notificações.' });
        }
    },

    // Marcar como lida
    markAsRead: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            await db.query('UPDATE business_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);

            res.json({ message: 'Notificação marcada como lida.' });
        } catch (error) {
            console.error('Erro ao marcar como lida:', error);
            res.status(500).json({ error: 'Erro ao atualizar notificação.' });
        }
    },

    // Marcar todas como lidas
    markAllAsRead: async (req, res) => {
        try {
            const userId = req.user.id;

            await db.query('UPDATE business_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId]);

            res.json({ message: 'Todas as notificações marcadas como lidas.' });
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
            res.status(500).json({ error: 'Erro ao atualizar notificações.' });
        }
    },

    // Contador de não lidas
    getUnreadCount: async (req, res) => {
        try {
            const userId = req.user.id;

            const [[{ unreadCount }]] = await db.query('SELECT COUNT(*) as unreadCount FROM business_notifications WHERE user_id = ? AND is_read = 0', [userId]);

            res.json({ unreadCount });
        } catch (error) {
            console.error('Erro ao buscar contador:', error);
            res.status(500).json({ error: 'Erro ao buscar contador.' });
        }
    },

    // Função auxiliar para criar notificação de negócio (usada por outros controllers)
    createBusinessNotification: async (userId, type, sourceBusinessId, content, actionUrl, sourcePostId = null, sourceStoryId = null, sourceCampaignId = null) => {
        try {
            await db.query(
                `INSERT INTO business_notifications (user_id, type, source_business_id, source_post_id, source_story_id, source_campaign_id, content, action_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, type, sourceBusinessId, sourcePostId, sourceStoryId, sourceCampaignId, content, actionUrl]
            );

            // Enviar via socket se usuário online
            socketHelper.sendToUser(userId, 'new_business_notification', {
                type,
                businessId: sourceBusinessId,
                content,
                actionUrl
            });
        } catch (error) {
            console.error('Erro ao criar notificação de negócio:', error);
        }
    }
};

module.exports = businessNotificationController;