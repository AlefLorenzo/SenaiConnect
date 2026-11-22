const db = require('../db');
const socketHelper = require('../socketHelper');
const { logAdminAction } = require('./adminAuthController');
const notificationController = require('./notificationController');

const adminNoticesController = {
    // Listar todos os avisos com filtros
    listNotices: async (req, res) => {
        try {
            const { search, status, priority, page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (search) {
                whereClause += ' AND (n.title LIKE ? OR n.content LIKE ? OR u.name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (status) {
                whereClause += ' AND n.status = ?';
                params.push(status);
            }
            if (priority) {
                whereClause += ' AND n.priority = ?';
                params.push(priority);
            }

            // Query principal
            const query = `
                SELECT n.*, u.name as author_name, u.avatar as author_avatar
                FROM notices n
                JOIN users u ON n.author_id = u.id
                ${whereClause}
                ORDER BY n.is_pinned DESC, n.published_at DESC, n.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);
            const [notices] = await db.query(query, params);

            // Total para paginação
            const countQuery = `
                SELECT COUNT(*) as total
                FROM notices n
                JOIN users u ON n.author_id = u.id
                ${whereClause}
            `;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({
                notices,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        } catch (error) {
            console.error('Erro ao listar avisos:', error);
            res.status(500).json({ error: 'Erro ao listar avisos' });
        }
    },

    // Buscar aviso por ID
    getNotice: async (req, res) => {
        try {
            const { id } = req.params;
            const [notices] = await db.query(`
                SELECT n.*, u.name as author_name, u.email as author_email
                FROM notices n
                JOIN users u ON n.author_id = u.id
                WHERE n.id = ?
            `, [id]);

            if (notices.length === 0) {
                return res.status(404).json({ error: 'Aviso não encontrado' });
            }

            res.json(notices[0]);
        } catch (error) {
            console.error('Erro ao buscar aviso:', error);
            res.status(500).json({ error: 'Erro ao buscar aviso' });
        }
    },

    // Criar novo aviso
    createNotice: async (req, res) => {
        try {
            const admin = req.admin;
            const {
                title,
                content,
                priority = 'normal',
                recipients = 'all',
                published_at = null,
                expires_at = null,
                is_pinned = false,
                image_url = null,
                attachment_url = null,
                attachment_name = null,
                send_notification = true
            } = req.body;

            if (!title) {
                return res.status(400).json({ error: 'Título é obrigatório' });
            }

            // Determinar status baseado em published_at
            let status = 'draft';
            if (published_at) {
                const pubDate = new Date(published_at);
                if (pubDate <= new Date()) {
                    status = 'published';
                } else {
                    status = 'scheduled';
                }
            } else {
                status = 'published'; // Publicar imediatamente se não agendado
            }

            const recipientsJson = typeof recipients === 'string' ? recipients : JSON.stringify(recipients);

            const [result] = await db.query(
                `INSERT INTO notices (author_id, title, content, priority, recipients, published_at, expires_at, is_pinned, status, image_url, attachment_url, attachment_name, send_notification)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [admin.id, title, content || '', priority, recipientsJson, published_at, expires_at, is_pinned ? 1 : 0, status, image_url, attachment_url, attachment_name, send_notification ? 1 : 0]
            );

            const [notice] = await db.query(`
                SELECT n.*, u.name as author_name, u.avatar as author_avatar
                FROM notices n
                JOIN users u ON n.author_id = u.id
                WHERE n.id = ?
            `, [result.insertId]);

            const newNotice = notice[0];

            // Broadcast em tempo real
            socketHelper.broadcast('new_notice', newNotice);

            // Log de auditoria
            await logAdminAction(admin.id, 'NOTICE_CREATED', 'notice', newNotice.id, `Criou o aviso "${newNotice.title}"`, { priority, recipients: recipientsJson }, req);

            // Enviar notificações se publicado e configurado
            if (status === 'published' && send_notification) {
                await sendNoticeNotifications(newNotice, recipientsJson);
            }

            res.status(201).json(newNotice);
        } catch (error) {
            console.error('Erro ao criar aviso:', error);
            res.status(500).json({ error: 'Erro ao criar aviso' });
        }
    },

    // Atualizar aviso
    updateNotice: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const {
                title,
                content,
                priority,
                recipients,
                published_at,
                expires_at,
                is_pinned,
                image_url,
                attachment_url,
                attachment_name,
                send_notification
            } = req.body;

            const [existing] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Aviso não encontrado' });
            }

            const oldNotice = existing[0];
            const wasPublished = oldNotice.status === 'published';

            // Determinar novo status
            let status = oldNotice.status;
            if (published_at !== undefined) {
                if (published_at) {
                    const pubDate = new Date(published_at);
                    status = pubDate <= new Date() ? 'published' : 'scheduled';
                } else {
                    status = 'draft';
                }
            }

            const recipientsJson = recipients !== undefined && typeof recipients !== 'string' ? JSON.stringify(recipients) : recipients;

            const updates = [];
            const values = [];

            if (title !== undefined) { updates.push('title = ?'); values.push(title); }
            if (content !== undefined) { updates.push('content = ?'); values.push(content || ''); }
            if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
            if (recipientsJson !== undefined) { updates.push('recipients = ?'); values.push(recipientsJson); }
            if (published_at !== undefined) { updates.push('published_at = ?'); values.push(published_at); }
            if (expires_at !== undefined) { updates.push('expires_at = ?'); values.push(expires_at); }
            if (is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(is_pinned ? 1 : 0); }
            if (status !== undefined) { updates.push('status = ?'); values.push(status); }
            if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
            if (attachment_url !== undefined) { updates.push('attachment_url = ?'); values.push(attachment_url); }
            if (attachment_name !== undefined) { updates.push('attachment_name = ?'); values.push(attachment_name); }
            if (send_notification !== undefined) { updates.push('send_notification = ?'); values.push(send_notification ? 1 : 0); }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            await db.query(`UPDATE notices SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query(`
                SELECT n.*, u.name as author_name, u.avatar as author_avatar
                FROM notices n
                JOIN users u ON n.author_id = u.id
                WHERE n.id = ?
            `, [id]);

            const newNotice = updated[0];

            // Broadcast de atualização
            socketHelper.broadcast('notice_updated', newNotice);

            // Log de auditoria
            const changes = [];
            if (title !== undefined && title !== oldNotice.title) changes.push(`title: "${oldNotice.title}" → "${title}"`);
            if (priority !== undefined && priority !== oldNotice.priority) changes.push(`priority: ${oldNotice.priority} → ${priority}`);
            if (status !== oldNotice.status) changes.push(`status: ${oldNotice.status} → ${status}`);

            await logAdminAction(admin.id, 'NOTICE_UPDATED', 'notice', parseInt(id), `Editou o aviso "${newNotice.title}"`, { changes }, req);

            // Se mudou para publicado e não era antes, enviar notificações
            if (status === 'published' && !wasPublished && newNotice.send_notification) {
                await sendNoticeNotifications(newNotice, newNotice.recipients);
            }

            res.json(newNotice);
        } catch (error) {
            console.error('Erro ao atualizar aviso:', error);
            res.status(500).json({ error: 'Erro ao atualizar aviso' });
        }
    },

    // Excluir aviso
    deleteNotice: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;

            const [existing] = await db.query('SELECT title FROM notices WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Aviso não encontrado' });
            }

            await db.query('DELETE FROM notices WHERE id = ?', [id]);

            socketHelper.broadcast('notice_deleted', { id: parseInt(id) });

            await logAdminAction(admin.id, 'NOTICE_DELETED', 'notice', parseInt(id), `Apagou o aviso "${existing[0].title}"`, null, req);

            res.json({ message: 'Aviso apagado com sucesso' });
        } catch (error) {
            console.error('Erro ao excluir aviso:', error);
            res.status(500).json({ error: 'Erro ao excluir aviso' });
        }
    },

    // Publicar/Despublicar aviso
    togglePublish: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { publish } = req.body;

            const [existing] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Aviso não encontrado' });
            }

            const notice = existing[0];
            const newStatus = publish ? 'published' : 'draft';
            const publishedAt = publish ? new Date() : null;

            await db.query(
                'UPDATE notices SET status = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStatus, publishedAt, id]
            );

            const [updated] = await db.query(`
                SELECT n.*, u.name as author_name
                FROM notices n
                JOIN users u ON n.author_id = u.id
                WHERE n.id = ?
            `, [id]);

            socketHelper.broadcast('notice_updated', updated[0]);

            await logAdminAction(admin.id, publish ? 'NOTICE_PUBLISHED' : 'NOTICE_UNPUBLISHED', 'notice', parseInt(id), `${publish ? 'Publicou' : 'Despublicou'} o aviso "${updated[0].title}"`, null, req);

            // Enviar notificações se publicado
            if (publish && updated[0].send_notification) {
                await sendNoticeNotifications(updated[0], updated[0].recipients);
            }

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao alterar publicação:', error);
            res.status(500).json({ error: 'Erro ao alterar status de publicação' });
        }
    },

    // Fixar/Desfixar aviso
    togglePin: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { pin } = req.body;

            await db.query('UPDATE notices SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pin ? 1 : 0, id]);

            const [updated] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);

            await logAdminAction(admin.id, pin ? 'NOTICE_PINNED' : 'NOTICE_UNPINNED', 'notice', parseInt(id), `${pin ? 'Fixou' : 'Desfixou'} o aviso "${updated[0].title}"`, null, req);

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao fixar aviso:', error);
            res.status(500).json({ error: 'Erro ao fixar/desfixar aviso' });
        }
    },

    // Estatísticas de avisos
    getStats: async (req, res) => {
        try {
            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM notices');
            const [[{ published }]] = await db.query("SELECT COUNT(*) as published FROM notices WHERE status = 'published'");
            const [[{ draft }]] = await db.query("SELECT COUNT(*) as draft FROM notices WHERE status = 'draft'");
            const [[{ scheduled }]] = await db.query("SELECT COUNT(*) as scheduled FROM notices WHERE status = 'scheduled'");
            const [[{ expired }]] = await db.query("SELECT COUNT(*) as expired FROM notices WHERE status = 'expired'");
            const [[{ pinned }]] = await db.query('SELECT COUNT(*) as pinned FROM notices WHERE is_pinned = 1');
            const [[{ urgent }]] = await db.query("SELECT COUNT(*) as urgent FROM notices WHERE priority = 'urgent' AND status = 'published'");
            const [[{ thisWeek }]] = await db.query("SELECT COUNT(*) as thisWeek FROM notices WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");

            res.json({
                total,
                published,
                draft,
                scheduled,
                expired,
                pinned,
                urgent,
                thisWeek
            });
        } catch (error) {
            console.error('Erro ao buscar stats de avisos:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas de avisos' });
        }
    }
};

// Função auxiliar para enviar notificações de aviso
async function sendNoticeNotifications(notice, recipientsJson) {
    try {
        let recipients = { type: 'all' };
        if (recipientsJson && typeof recipientsJson === 'object') {
            recipients = recipientsJson;
        } else if (typeof recipientsJson === 'string') {
            try {
                recipients = JSON.parse(recipientsJson);
            } catch {
                recipients = { type: recipientsJson || 'all' };
            }
        }

        const values = Array.isArray(recipients.values)
            ? recipients.values.map(value => String(value).trim()).filter(Boolean)
            : [];
        let users = [];

        if (recipients.type === 'all' || !recipients.type) {
            [users] = await db.query(`
                SELECT id FROM users
                WHERE LOWER(role) IN ('aluno', 'student', 'estudante')
                  AND is_blocked = 0 AND deleted_at IS NULL
            `);
        } else if (recipients.type === 'courses' && values.length > 0) {
            [users] = await db.query(
                `SELECT id FROM users
                 WHERE course IN (${values.map(() => '?').join(',')})
                   AND is_blocked = 0 AND deleted_at IS NULL`,
                values
            );
        } else if (recipients.type === 'units' && values.length > 0) {
            [users] = await db.query(
                `SELECT id FROM users
                 WHERE unit IN (${values.map(() => '?').join(',')})
                   AND is_blocked = 0 AND deleted_at IS NULL`,
                values
            );
        } else if (recipients.type === 'admins') {
            [users] = await db.query('SELECT id FROM users WHERE admin_role IS NOT NULL AND is_blocked = 0 AND deleted_at IS NULL');
        } else if (recipients.type === 'teachers') {
            [users] = await db.query(`
                SELECT id FROM users
                WHERE LOWER(role) IN ('professor', 'professora', 'teacher', 'docente')
                  AND is_blocked = 0 AND deleted_at IS NULL
            `);
        }
        const userIds = users.map(user => user.id);

        // Enviar notificação em lotes
        for (const userId of userIds) {
            await notificationController.createNotification(
                userId,
                'notice',
                notice.author_id,
                notice.id,
                `Novo aviso: ${notice.title}`,
                { priority: notice.priority, noticeId: notice.id }
            );
        }

        // Broadcast via socket para usuários online
        userIds.forEach(uid => {
            socketHelper.sendToUser(uid, 'new_notice_alert', {
                noticeId: notice.id,
                title: notice.title,
                priority: notice.priority
            });
        });
    } catch (error) {
        console.error('Erro ao enviar notificações de aviso:', error);
    }
}

module.exports = adminNoticesController;