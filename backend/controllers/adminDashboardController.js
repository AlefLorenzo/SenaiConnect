const db = require('../db');

// Estatísticas gerais do dashboard
async function getStats(req, res) {
    try {
        // Total de alunos
        const [[{ totalStudents }]] = await db.query(
            "SELECT COUNT(*) as totalStudents FROM users WHERE role = 'Aluno'"
        );

        // Usuários ativos (últimos 7 dias) - usando nomes corretos das colunas
        const [[{ activeUsers }]] = await db.query(`
            SELECT COUNT(DISTINCT u.id) as activeUsers
            FROM users u
            LEFT JOIN (
                SELECT user_id as user_id FROM posts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                UNION SELECT user_id as user_id FROM comments WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                UNION SELECT sender_id as user_id FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                UNION SELECT author_id as user_id FROM notices WHERE published_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ) a ON u.id = a.user_id
            WHERE u.role = 'Aluno' AND a.user_id IS NOT NULL
        `);

        // Total de avisos publicados (notices com published_at não nulo)
        const [[{ totalNotices }]] = await db.query(
            "SELECT COUNT(*) as totalNotices FROM notices WHERE published_at IS NOT NULL"
        );

        // Denúncias pendentes
        const [[{ pendingReports }]] = await db.query(
            "SELECT COUNT(*) as pendingReports FROM reports WHERE status = 'pending'"
        );

        // Denúncias resolvidas
        const [[{ resolvedReports }]] = await db.query(
            "SELECT COUNT(*) as resolvedReports FROM reports WHERE status = 'resolved'"
        );

        // Denúncias em análise
        const [[{ reviewingReports }]] = await db.query(
            "SELECT COUNT(*) as reviewingReports FROM reports WHERE status = 'reviewing'"
        );

        // Atividades recentes (últimas 10 ações admin)
        const [recentActivity] = await db.query(`
            SELECT al.*, u.name as admin_name, u.avatar as admin_avatar
            FROM admin_logs al
            JOIN users u ON al.admin_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);

        // Crescimento de usuários (últimos 30 dias)
        const [userGrowth] = await db.query(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as new_users
            FROM users
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Denúncias por categoria
        const [reportsByCategory] = await db.query(`
            SELECT
                CASE
                    WHEN target_type = 'user' THEN 'user'
                    WHEN target_type = 'post' THEN 'post'
                    WHEN target_type = 'comment' THEN 'comment'
                    WHEN target_type = 'message' THEN 'message'
                    WHEN target_type = 'group' THEN 'group'
                    ELSE 'other'
                END as category,
                COUNT(*) as count
            FROM reports
            GROUP BY category
        `);

        // Posts por dia (últimos 30 dias)
        const [postsPerDay] = await db.query(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as posts
            FROM posts
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Usuários por role
        const [usersByRole] = await db.query(`
            SELECT role, COUNT(*) as count
            FROM users
            GROUP BY role
        `);

        // Avisos por prioridade (notices não tem status, usar todos)
        const [noticesByPriority] = await db.query(`
            SELECT priority, COUNT(*) as count
            FROM notices
            GROUP BY priority
        `);

        res.json({
            stats: {
                totalStudents,
                activeUsers,
                totalNotices,
                pendingReports,
                resolvedReports,
                reviewingReports
            },
            recentActivity,
            charts: {
                userGrowth,
                reportsByCategory,
                postsPerDay,
                usersByRole,
                noticesByPriority
            }
        });
    } catch (error) {
        console.error('Erro no dashboard admin:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas do dashboard' });
    }
}

// Novos endpoints para gráficos e atividade
async function getCharts(req, res) {
    try {
        // Crescimento de usuários (últimos 30 dias)
        const [userGrowth] = await db.query(`
            SELECT DATE(created_at) as date, COUNT(*) as new_users
            FROM users
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Denúncias por categoria
        const [reportsByCategory] = await db.query(`
            SELECT
                CASE
                    WHEN target_type = 'user' THEN 'Usuário'
                    WHEN target_type = 'post' THEN 'Post'
                    WHEN target_type = 'comment' THEN 'Comentário'
                    WHEN target_type = 'message' THEN 'Mensagem'
                    WHEN target_type = 'group' THEN 'Grupo'
                    ELSE 'Outros'
                END as category,
                COUNT(*) as count
            FROM reports
            GROUP BY category
        `);

        // Posts por dia (últimos 30 dias)
        const [postsPerDay] = await db.query(`
            SELECT DATE(created_at) as date, COUNT(*) as posts
            FROM posts
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND deleted_at IS NULL
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Usuários por role
        const [usersByRole] = await db.query(`
            SELECT role, COUNT(*) as count
            FROM users
            GROUP BY role
        `);

        // Avisos por prioridade
        const [noticesByPriority] = await db.query(`
            SELECT priority, COUNT(*) as count
            FROM notices
            GROUP BY priority
        `);

        res.json({
            charts: {
                userGrowth,
                reportsByCategory,
                postsPerDay,
                usersByRole,
                noticesByPriority
            }
        });
    } catch (error) {
        console.error('Erro ao buscar gráficos:', error);
        res.status(500).json({ error: 'Erro ao buscar dados dos gráficos' });
    }
}

async function getActivity(req, res) {
    try {
        const [activity] = await db.query(`
            SELECT al.*, u.name as admin_name, u.avatar as admin_avatar
            FROM admin_logs al
            JOIN users u ON al.admin_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 20
        `);
        res.json({ activity });
    } catch (error) {
        console.error('Erro ao buscar atividade:', error);
        res.status(500).json({ error: 'Erro ao buscar atividade' });
    }
}

module.exports = { getStats, getCharts, getActivity };