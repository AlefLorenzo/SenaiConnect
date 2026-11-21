const db = require('../db');

const adminAuditController = {
    // Listar logs de auditoria com filtros
    listLogs: async (req, res) => {
        try {
            const { search, action, admin_id, target_type, date_from, date_to, page = 1, limit = 50 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (search) {
                whereClause += ' AND (al.description LIKE ? OR al.target_name LIKE ? OR u.name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (action) {
                whereClause += ' AND al.action = ?';
                params.push(action);
            }
            if (admin_id) {
                whereClause += ' AND al.admin_id = ?';
                params.push(admin_id);
            }
            if (target_type) {
                whereClause += ' AND al.target_type = ?';
                params.push(target_type);
            }
            if (date_from) {
                whereClause += ' AND DATE(al.created_at) >= ?';
                params.push(date_from);
            }
            if (date_to) {
                whereClause += ' AND DATE(al.created_at) <= ?';
                params.push(date_to);
            }

            const query = `
                SELECT al.*, u.name as admin_name, u.avatar as admin_avatar, u.admin_role as admin_role
                FROM admin_logs al
                JOIN users u ON al.admin_id = u.id
                ${whereClause}
                ORDER BY al.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);
            const [logs] = await db.query(query, params);

            // Parse metadata JSON
            logs.forEach(log => {
                if (log.metadata) {
                    try {
                        log.metadata = JSON.parse(log.metadata);
                    } catch {
                        log.metadata = null;
                    }
                }
            });

            // Total para paginação
            const countQuery = `
                SELECT COUNT(*) as total
                FROM admin_logs al
                JOIN users u ON al.admin_id = u.id
                ${whereClause}
            `;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({
                logs,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        } catch (error) {
            console.error('Erro ao listar logs de auditoria:', error);
            res.status(500).json({ error: 'Erro ao listar logs de auditoria' });
        }
    },

    // Buscar detalhes de um log
    getLog: async (req, res) => {
        try {
            const { id } = req.params;
            const [logs] = await db.query(`
                SELECT al.*, u.name as admin_name, u.email as admin_email, u.avatar as admin_avatar, u.admin_role
                FROM admin_logs al
                JOIN users u ON al.admin_id = u.id
                WHERE al.id = ?
            `, [id]);

            if (logs.length === 0) {
                return res.status(404).json({ error: 'Log não encontrado' });
            }

            const log = logs[0];
            if (log.metadata) {
                try {
                    log.metadata = JSON.parse(log.metadata);
                } catch {
                    log.metadata = null;
                }
            }

            res.json(log);
        } catch (error) {
            console.error('Erro ao buscar log:', error);
            res.status(500).json({ error: 'Erro ao buscar log' });
        }
    },

    // Estatísticas de auditoria
    getStats: async (req, res) => {
        try {
            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM admin_logs');
            const [[{ today }]] = await db.query('SELECT COUNT(*) as today FROM admin_logs WHERE DATE(created_at) = CURDATE()');
            const [[{ thisWeek }]] = await db.query('SELECT COUNT(*) as thisWeek FROM admin_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
            const [[{ thisMonth }]] = await db.query('SELECT COUNT(*) as thisMonth FROM admin_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');

            // Por ação
            const [byAction] = await db.query(`
                SELECT action, action_label, COUNT(*) as count
                FROM admin_logs
                GROUP BY action, action_label
                ORDER BY count DESC
            `);

            // Por admin
            const [byAdmin] = await db.query(`
                SELECT u.name, u.admin_role, COUNT(*) as count
                FROM admin_logs al
                JOIN users u ON al.admin_id = u.id
                GROUP BY al.admin_id, u.name, u.admin_role
                ORDER BY count DESC
                LIMIT 10
            `);

            // Por target_type
            const [byTarget] = await db.query(`
                SELECT target_type, COUNT(*) as count
                FROM admin_logs
                WHERE target_type IS NOT NULL
                GROUP BY target_type
                ORDER BY count DESC
            `);

            // Timeline (últimos 30 dias)
            const [timeline] = await db.query(`
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM admin_logs
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `);

            res.json({
                overview: { total, today, thisWeek, thisMonth },
                byAction,
                byAdmin,
                byTarget,
                timeline
            });
        } catch (error) {
            console.error('Erro ao buscar stats de auditoria:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas de auditoria' });
        }
    },

    // Exportar logs (CSV)
    exportLogs: async (req, res) => {
        try {
            const { date_from, date_to, action, admin_id } = req.query;

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (date_from) {
                whereClause += ' AND DATE(al.created_at) >= ?';
                params.push(date_from);
            }
            if (date_to) {
                whereClause += ' AND DATE(al.created_at) <= ?';
                params.push(date_to);
            }
            if (action) {
                whereClause += ' AND al.action = ?';
                params.push(action);
            }
            if (admin_id) {
                whereClause += ' AND al.admin_id = ?';
                params.push(admin_id);
            }

            const query = `
                SELECT al.id, al.action, al.action_label, al.target_type, al.target_id, al.target_name,
                       al.description, al.metadata, al.ip_address, al.user_agent, al.created_at,
                       u.name as admin_name, u.admin_role
                FROM admin_logs al
                JOIN users u ON al.admin_id = u.id
                ${whereClause}
                ORDER BY al.created_at DESC
            `;

            const [logs] = await db.query(query, params);

            // Gerar CSV
            const headers = ['ID', 'Ação', 'Label', 'Tipo Alvo', 'ID Alvo', 'Nome Alvo', 'Descrição', 'Metadados', 'IP', 'User Agent', 'Data/Hora', 'Admin', 'Role Admin'];
            const rows = logs.map(log => [
                log.id,
                log.action,
                log.action_label,
                log.target_type || '',
                log.target_id || '',
                log.target_name || '',
                log.description || '',
                log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '',
                log.ip_address || '',
                log.user_agent || '',
                new Date(log.created_at).toLocaleString('pt-BR'),
                log.admin_name,
                log.admin_role || ''
            ]);

            const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send('﻿' + csv); // BOM para UTF-8 no Excel
        } catch (error) {
            console.error('Erro ao exportar logs:', error);
            res.status(500).json({ error: 'Erro ao exportar logs' });
        }
    },

    // Ações disponíveis para filtro
    getActions: async (req, res) => {
        try {
            const [actions] = await db.query(`
                SELECT DISTINCT action, action_label
                FROM admin_logs
                ORDER BY action_label
            `);
            res.json(actions);
        } catch (error) {
            console.error('Erro ao buscar ações:', error);
            res.status(500).json({ error: 'Erro ao buscar ações' });
        }
    }
};

module.exports = adminAuditController;