const db = require('../db');

const noticeController = {
    getNotices: async (req, res) => {
        try {
            const { buildNoticeVisibilityClause } = require('../utils/contentVisibility');
            const visibility = buildNoticeVisibilityClause(req.user, 'n');
            const [notices] = await db.query(`
                SELECT n.*, u.name as author_name, u.avatar as author_avatar, nr.read_at
                FROM notices n
                JOIN users u ON n.author_id = u.id
                LEFT JOIN notice_reads nr ON nr.notice_id = n.id AND nr.user_id = ?
                WHERE (n.status = 'published' OR (n.status = 'scheduled' AND n.published_at <= NOW()))
                  AND (n.published_at IS NULL OR n.published_at <= NOW())
                  AND (n.expires_at IS NULL OR n.expires_at > NOW())
                  AND ${visibility.sql}
                ORDER BY n.is_pinned DESC, n.published_at DESC NULLS LAST, n.created_at DESC
            `, [req.user.id, ...visibility.params]);
            res.status(200).json(notices);
        } catch (error) {
            console.error('Erro ao buscar avisos visíveis:', error);
            res.status(500).json({ error: 'Erro ao buscar avisos' });
        }
    },

    markNoticeRead: async (req, res) => {
        try {
            const { buildNoticeVisibilityClause } = require('../utils/contentVisibility');
            const visibility = buildNoticeVisibilityClause(req.user, 'n');
            const [visible] = await db.query(`
                SELECT n.id
                FROM notices n
                WHERE n.id = ?
                  AND (n.status = 'published' OR (n.status = 'scheduled' AND n.published_at <= NOW()))
                  AND (n.published_at IS NULL OR n.published_at <= NOW())
                  AND (n.expires_at IS NULL OR n.expires_at > NOW())
                  AND ${visibility.sql}
                LIMIT 1
            `, [req.params.id, ...visibility.params]);

            if (!visible.length) {
                return res.status(404).json({ error: 'Aviso não encontrado.' });
            }

            await db.query(`
                INSERT INTO notice_reads (notice_id, user_id)
                SELECT ?, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM notice_reads WHERE notice_id = ? AND user_id = ?
                )
            `, [req.params.id, req.user.id, req.params.id, req.user.id]);

            return res.status(200).json({ notice_id: Number(req.params.id), read: true });
        } catch (error) {
            console.error('Erro ao marcar aviso como lido:', error);
            return res.status(500).json({ error: 'Não foi possível marcar o aviso como lido.' });
        }
    },

    getNoticeFiles: async (req, res) => {
        try {
            const { buildNoticeVisibilityClause } = require('../utils/contentVisibility');
            const visibility = buildNoticeVisibilityClause(req.user, 'n');
            const [files] = await db.query(`
                SELECT n.id as notice_id, n.title, n.attachment_url, n.attachment_name,
                       n.created_at, n.published_at, n.priority,
                       u.name as author_name
                FROM notices n
                LEFT JOIN users u ON u.id = n.author_id
                WHERE (n.status = 'published' OR (n.status = 'scheduled' AND n.published_at <= NOW()))
                  AND (n.published_at IS NULL OR n.published_at <= NOW())
                  AND (n.expires_at IS NULL OR n.expires_at > NOW())
                  AND n.attachment_url IS NOT NULL
                  AND TRIM(n.attachment_url) <> ''
                  AND ${visibility.sql}
                ORDER BY n.is_pinned DESC, n.published_at DESC NULLS LAST, n.created_at DESC
            `, visibility.params);
            res.status(200).json(files);
        } catch (error) {
            console.error('Erro ao buscar arquivos administrativos:', error);
            res.status(500).json({ error: 'Erro ao buscar arquivos' });
        }
    },

    createNotice: async (req, res) => {
        try {
            const { title, content } = req.body;
            const authorId = req.user.id;

            if (!title) return res.status(400).json({ error: 'Título é obrigatório.' });

            const [result] = await db.query(
                'INSERT INTO notices (author_id, title, content) VALUES (?, ?, ?)',
                [authorId, title, content || '']
            );

            const noticeId = result.insertId;

            // Create Activity Center notifications for all users (institutional notice)
            const notificationController = require('./notificationController');
            const [users] = await db.query('SELECT id FROM users WHERE id != ?', [authorId]);

            for (const user of users) {
                await notificationController.createNotification(
                    user.id,
                    'notice',
                    authorId,
                    `Novo aviso institucional: ${title}`,
                    'notice',
                    noticeId,
                    `notice_${noticeId}`,
                    { action: 'notice', notice_id: noticeId, title }
                );
            }

            res.status(201).json({ id: noticeId, message: 'Aviso criado com sucesso!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar aviso' });
        }
    },

    getEvents: async (req, res) => {
        try {
            const { buildUnitVisibilityClause } = require('../utils/contentVisibility');
            const visibility = buildUnitVisibilityClause(req.user, 'e');
            const [events] = await db.query(`
                SELECT e.*, u.name as author_name
                FROM events e
                LEFT JOIN users u ON u.id = e.author_id
                WHERE LOWER(TRIM(COALESCE(e.status, ''))) IN ('ativo', 'active')
                  AND ${visibility.sql}
                ORDER BY e.event_date ASC
            `, visibility.params);
            res.status(200).json(events);
        } catch (error) {
            console.error('Erro ao buscar eventos:', error);
            res.status(500).json({ error: 'Erro ao buscar eventos' });
        }
    },

    createEvent: async (req, res) => {
        try {
            const { title, description, event_date, location } = req.body;
            const authorId = req.user.id;

            if (!title || !event_date) return res.status(400).json({ error: 'Título e data do evento são obrigatórios.' });

            const [result] = await db.query(
                'INSERT INTO events (author_id, title, description, event_date, location) VALUES (?, ?, ?, ?, ?)',
                [authorId, title, description || '', event_date, location || '']
            );

            const eventId = result.insertId;

            // Create Activity Center notifications for all users (event reminder)
            const notificationController = require('./notificationController');
            const [users] = await db.query('SELECT id FROM users WHERE id != ?', [authorId]);

            for (const user of users) {
                await notificationController.createNotification(
                    user.id,
                    'event_reminder',
                    authorId,
                    `Novo evento: ${title} em ${new Date(event_date).toLocaleDateString('pt-BR')}`,
                    'event',
                    eventId,
                    `event_${eventId}`,
                    { action: 'event', event_id: eventId, title, event_date, location }
                );
            }

            res.status(201).json({ id: eventId, message: 'Evento criado com sucesso!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar evento' });
        }
    }
};

module.exports = noticeController;
