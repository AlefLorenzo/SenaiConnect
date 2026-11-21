const db = require('../db');
const socketHelper = require('../socketHelper');
const { logAdminAction } = require('./adminAuthController');
const notificationController = require('./notificationController');
const moderationController = require('./moderationController');

const adminReportsController = {
    // Listar denúncias com filtros
    listReports: async (req, res) => {
        try {
            const { search, status, category, page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (search) {
                whereClause += ' AND (r.description LIKE ? OR u.name LIKE ? OR r.reason LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (status) {
                whereClause += ' AND r.status = ?';
                params.push(status);
            }
            if (category) {
                whereClause += ' AND r.reason = ?';
                params.push(category);
            }

            const query = `
                SELECT r.*, u.name as reporter_name, u.email as reporter_email, u.avatar as reporter_avatar,
                       admin.name as assigned_admin_name
                FROM reports r
                JOIN users u ON r.reporter_id = u.id
                LEFT JOIN users admin ON r.assigned_to = admin.id
                ${whereClause}
                ORDER BY
                    CASE r.status
                        WHEN 'pending' THEN 1
                        WHEN 'reviewing' THEN 2
                        WHEN 'resolved' THEN 3
                        WHEN 'dismissed' THEN 4
                        ELSE 5
                    END,
                    r.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);
            const [reports] = await db.query(query, params);

            // Buscar detalhes do alvo para cada denúncia
            for (const report of reports) {
                if (report.target_type === 'user') {
                    const [target] = await db.query('SELECT id, name, avatar, role FROM users WHERE id = ?', [report.target_id]);
                    report.target_user = target[0] || null;
                } else if (report.target_type === 'post') {
                    const [target] = await db.query(`
                        SELECT p.id, p.content, p.user_id, u.name as author_name, u.avatar as author_avatar
                        FROM posts p
                        JOIN users u ON p.user_id = u.id
                        WHERE p.id = ?
                    `, [report.target_id]);
                    report.target_post = target[0] || null;
                } else if (report.target_type === 'comment') {
                    const [target] = await db.query(`
                        SELECT c.id, c.content, c.user_id, u.name as author_name
                        FROM comments c
                        JOIN users u ON c.user_id = u.id
                        WHERE c.id = ?
                    `, [report.target_id]);
                    report.target_comment = target[0] || null;
                }
            }

            // Total para paginação
            const countQuery = `
                SELECT COUNT(*) as total
                FROM reports r
                JOIN users u ON r.reporter_id = u.id
                ${whereClause}
            `;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({
                reports,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        } catch (error) {
            console.error('Erro ao listar denúncias:', error);
            res.status(500).json({ error: 'Erro ao listar denúncias' });
        }
    },

    // Buscar detalhes de uma denúncia
    getReport: async (req, res) => {
        try {
            const { id } = req.params;
            const [reports] = await db.query(`
                SELECT r.*, u.name as reporter_name, u.email as reporter_email, u.avatar as reporter_avatar, u.role as reporter_role,
                       admin.name as assigned_admin_name
                FROM reports r
                JOIN users u ON r.reporter_id = u.id
                LEFT JOIN users admin ON r.assigned_to = admin.id
                WHERE r.id = ?
            `, [id]);

            if (reports.length === 0) {
                return res.status(404).json({ error: 'Denúncia não encontrada' });
            }

            const report = reports[0];

            // Buscar detalhes do alvo
            if (report.target_type === 'user') {
                const [target] = await db.query('SELECT id, name, email, avatar, role, course, unit, created_at, is_blocked FROM users WHERE id = ?', [report.target_id]);
                report.target_user = target[0] || null;
                // Histórico de denúncias contra este usuário
                const [history] = await db.query('SELECT * FROM reports WHERE target_type = "user" AND target_id = ? ORDER BY created_at DESC', [report.target_id]);
                report.target_history = history;
            } else if (report.target_type === 'post') {
                const [target] = await db.query(`
                    SELECT p.*, u.name as author_name, u.avatar as author_avatar, u.role as author_role
                    FROM posts p
                    JOIN users u ON p.user_id = u.id
                    WHERE p.id = ?
                `, [report.target_id]);
                report.target_post = target[0] || null;
            } else if (report.target_type === 'comment') {
                const [target] = await db.query(`
                    SELECT c.*, u.name as author_name, u.avatar as author_avatar, p.id as post_id, p.content as post_content
                    FROM comments c
                    JOIN users u ON c.user_id = u.id
                    JOIN posts p ON c.post_id = p.id
                    WHERE c.id = ?
                `, [report.target_id]);
                report.target_comment = target[0] || null;
            } else if (report.target_type === 'message') {
                const [target] = await db.query(`
                    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = ?
                `, [report.target_id]);
                report.target_message = target[0] || null;
            }

            // Buscar advertências do usuário alvo
            if (report.target_user_id) {
                const [warnings] = await db.query(`
                    SELECT uw.*, u.name as admin_name
                    FROM user_warnings uw
                    JOIN users u ON uw.admin_id = u.id
                    WHERE uw.user_id = ?
                    ORDER BY uw.created_at DESC
                `, [report.target_user_id]);
                report.target_warnings = warnings;
            }

            // Buscar restrições ativas
            if (report.target_user_id) {
                const [restrictions] = await db.query(`
                    SELECT ur.*, u.name as admin_name
                    FROM user_restrictions ur
                    JOIN users u ON ur.admin_id = u.id
                    WHERE ur.user_id = ? AND ur.is_active = 1 AND ur.expires_at > NOW()
                    ORDER BY ur.created_at DESC
                `, [report.target_user_id]);
                report.target_restrictions = restrictions;
            }

            res.json(report);
        } catch (error) {
            console.error('Erro ao buscar denúncia:', error);
            res.status(500).json({ error: 'Erro ao buscar denúncia' });
        }
    },

    // Iniciar análise (atribuir a si mesmo)
    startReview: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;

            const [existing] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Denúncia não encontrada' });
            }

            if (existing[0].status !== 'pending') {
                return res.status(400).json({ error: 'Denúncia já está em análise ou finalizada' });
            }

            await db.query(
                'UPDATE reports SET status = "reviewing", assigned_to = ? WHERE id = ?',
                [admin.id, id]
            );

            const [updated] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);

            await logAdminAction(admin.id, 'REPORT_REVIEW_STARTED', 'report', parseInt(id), `Iniciou análise da denúncia #${id}`, null, req);

            socketHelper.broadcast('report_updated', updated[0]);

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao iniciar análise:', error);
            res.status(500).json({ error: 'Erro ao iniciar análise' });
        }
    },

    // Resolver denúncia (ação administrativa)
    resolveReport: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { action, notes, warning_reason, restriction_days, restriction_features } = req.body;

            const [existing] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Denúncia não encontrada' });
            }

            const report = existing[0];
            const targetUserId = report.target_user_id || (report.target_type === 'user' ? report.target_id : null);

            // Validar ação
            const validActions = ['remove_content', 'warn', 'restrict', 'dismiss'];
            if (!validActions.includes(action)) {
                return res.status(400).json({ error: 'Ação inválida' });
            }

            if (action === 'warn' && !warning_reason) {
                return res.status(400).json({ error: 'Motivo da advertência é obrigatório' });
            }

            if (action === 'restrict' && (!restriction_days || restriction_days < 1)) {
                return res.status(400).json({ error: 'Dias de restrição inválidos' });
            }

            // Executar ação
            let actionResult = null;

            switch (action) {
                case 'remove_content':
                    actionResult = await removeReportedContent(report);
                    break;
                case 'warn':
                    actionResult = await warnUser(targetUserId, admin.id, warning_reason, report.id);
                    break;
                case 'restrict':
                    actionResult = await restrictUser(targetUserId, admin.id, restriction_days, restriction_features || ['post', 'comment', 'message'], report.id);
                    break;
                case 'dismiss':
                    actionResult = { message: 'Denúncia arquivada como improcedente' };
                    break;
            }

            // Atualizar denúncia
            await db.query(
                `UPDATE reports SET status = "resolved", resolved_at = NOW(), action_taken = ?, admin_notes = ? WHERE id = ?`,
                [action, notes || '', id]
            );

            const [updated] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);

            await logAdminAction(admin.id, 'REPORT_RESOLVED', 'report', parseInt(id), `Resolveu denúncia #${id} com ação: ${action}`, { action, notes, result: actionResult }, req);

            socketHelper.broadcast('report_resolved', updated[0]);

            // Notificar denunciante
            await notificationController.createNotification(
                report.reporter_id,
                'report_resolved',
                admin.id,
                id,
                `Sua denúncia foi ${action === 'dismiss' ? 'arquivada' : 'resolvida'}`
            );

            res.json({ ...updated[0], actionResult });
        } catch (error) {
            console.error('Erro ao resolver denúncia:', error);
            res.status(500).json({ error: 'Erro ao resolver denúncia' });
        }
    },

    // Arquivar denúncia (improcedente)
    dismissReport: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { notes } = req.body;

            const [existing] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ error: 'Denúncia não encontrada' });
            }

            await db.query(
                `UPDATE reports SET status = "dismissed", resolved_at = NOW(), action_taken = "dismiss", admin_notes = ? WHERE id = ?`,
                [notes || '', id]
            );

            const [updated] = await db.query('SELECT * FROM reports WHERE id = ?', [id]);

            await logAdminAction(admin.id, 'REPORT_DISMISSED', 'report', parseInt(id), `Arquivou denúncia #${id} como improcedente`, { notes }, req);

            socketHelper.broadcast('report_resolved', updated[0]);

            // Notificar denunciante
            await notificationController.createNotification(
                existing[0].reporter_id,
                'report_dismissed',
                admin.id,
                id,
                'Sua denúncia foi arquivada como improcedente'
            );

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao arquivar denúncia:', error);
            res.status(500).json({ error: 'Erro ao arquivar denúncia' });
        }
    },

    // Estatísticas de denúncias
    getStats: async (req, res) => {
        try {
            const [[{ pending }]] = await db.query('SELECT COUNT(*) as pending FROM reports WHERE status = "pending"');
            const [[{ reviewing }]] = await db.query('SELECT COUNT(*) as reviewing FROM reports WHERE status = "reviewing"');
            const [[{ resolved }]] = await db.query('SELECT COUNT(*) as resolved FROM reports WHERE status = "resolved"');
            const [[{ dismissed }]] = await db.query('SELECT COUNT(*) as dismissed FROM reports WHERE status = "dismissed"');

            const [byCategory] = await db.query(`
                SELECT reason, COUNT(*) as count
                FROM reports
                GROUP BY reason
            `);

            const [byStatus] = await db.query(`
                SELECT status, COUNT(*) as count
                FROM reports
                GROUP BY status
            `);

            const [recent] = await db.query(`
                SELECT r.*, u.name as reporter_name
                FROM reports r
                JOIN users u ON r.reporter_id = u.id
                ORDER BY r.created_at DESC
                LIMIT 5
            `);

            res.json({
                summary: { pending, reviewing, resolved, dismissed },
                byCategory,
                byStatus,
                recent
            });
        } catch (error) {
            console.error('Erro ao buscar stats de denúncias:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas' });
        }
    }
};

// Funções auxiliares
async function removeReportedContent(report) {
    try {
        if (report.target_type === 'post') {
            await db.query('UPDATE posts SET deleted_at = NOW(), moderated_at = NOW(), moderated_by = ?, moderation_reason = ? WHERE id = ?',
                [report.assigned_to, `Removido via denúncia #${report.id}: ${report.reason}`, report.target_id]);
            // Broadcast remoção
            socketHelper.broadcast('post_deleted', { id: report.target_id });
            return { type: 'post_removed', targetId: report.target_id };
        } else if (report.target_type === 'comment') {
            await db.query('UPDATE comments SET deleted_at = NOW() WHERE id = ?', [report.target_id]);
            return { type: 'comment_removed', targetId: report.target_id };
        } else if (report.target_type === 'message') {
            await db.query('DELETE FROM messages WHERE id = ?', [report.target_id]);
            return { type: 'message_removed', targetId: report.target_id };
        }
        return { type: 'no_action', message: 'Tipo de conteúdo não suportado para remoção automática' };
    } catch (error) {
        console.error('Erro ao remover conteúdo:', error);
        return { type: 'error', error: error.message };
    }
}

async function warnUser(userId, adminId, reason, reportId) {
    if (!userId) return { type: 'error', message: 'Usuário alvo não identificado' };

    await db.query(
        'INSERT INTO user_warnings (user_id, admin_id, reason, description, report_id) VALUES (?, ?, ?, ?, ?)',
        [userId, adminId, reason, `Advertência emitida via denúncia #${reportId}`, reportId]
    );

    // Verificar se atingiu 3 advertências para auto-bloqueio
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM user_warnings WHERE user_id = ?', [userId]);
    if (count >= 3) {
        await db.query('UPDATE users SET is_blocked = 1 WHERE id = ?', [userId]);
        return { type: 'warn_issued', autoBlocked: true, warningCount: count };
    }

    return { type: 'warn_issued', warningCount: count };
}

async function restrictUser(userId, adminId, days, features, reportId) {
    if (!userId) return { type: 'error', message: 'Usuário alvo não identificado' };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await db.query(
        `INSERT INTO user_restrictions (user_id, admin_id, reason, features, expires_at, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, adminId, 'Restrição via denúncia', JSON.stringify(features), expiresAt, `Restrição de ${days} dias via denúncia #${reportId}`]
    );

    return { type: 'restriction_applied', expiresAt, features };
}

module.exports = adminReportsController;