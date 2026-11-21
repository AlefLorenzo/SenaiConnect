const db = require('../db');
const bcrypt = require('bcrypt');
const socketHelper = require('../socketHelper');
const { logAdminAction } = require('./adminAuthController');

const adminUsersController = {
    // Listar usuários com filtros e paginação
    listUsers: async (req, res) => {
        try {
            const { search, role, status, page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (search) {
                whereClause += ' AND (name LIKE ? OR email LIKE ? OR course LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (role) {
                whereClause += ' AND role = ?';
                params.push(role);
            }
            if (status) {
                if (status === 'blocked') {
                    whereClause += ' AND is_blocked = 1';
                } else if (status === 'active') {
                    whereClause += ' AND is_blocked = 0 AND deleted_at IS NULL';
                } else if (status === 'pending') {
                    whereClause += ' AND onboarding_completed = 0';
                }
            }

            const query = `
                SELECT id, name, email, role, avatar, unit, area, course, created_at,
                       is_blocked, is_private, admin_role, unit_id, onboarding_completed, NULL::timestamptz AS last_login
                FROM users
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);
            const [users] = await db.query(query, params);

            // Total para paginação
            const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            // Estatísticas rápidas
            const [[{ totalStudents }]] = await db.query("SELECT COUNT(*) as totalStudents FROM users WHERE role = 'Aluno'");
            const [[{ totalTeachers }]] = await db.query("SELECT COUNT(*) as totalTeachers FROM users WHERE role = 'Professor'");
            const [[{ totalAdmins }]] = await db.query("SELECT COUNT(*) as totalAdmins FROM users WHERE admin_role IS NOT NULL");
            const [[{ totalBlocked }]] = await db.query("SELECT COUNT(*) as totalBlocked FROM users WHERE is_blocked = TRUE");

            res.json({
                users,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
                stats: {
                    totalStudents,
                    totalTeachers,
                    totalAdmins,
                    totalBlocked
                }
            });
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            res.status(500).json({ error: 'Erro ao listar usuários' });
        }
    },

    // Buscar usuário por ID
    getUser: async (req, res) => {
        try {
            const { id } = req.params;
            const [users] = await db.query(`
                SELECT id, name, email, role, avatar, cover_image, bio, state, city, unit, area, course,
                       links, skills, skills_to_learn, interests, objective, onboarding_completed,
                       is_private, hide_email, notification_prefs, is_blocked, admin_role, unit_id,
                       created_at, deleted_at, NULL::timestamptz AS last_login
                FROM users
                WHERE id = ?
            `, [id]);

            if (users.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const user = users[0];

            // Estatísticas do usuário
            const [[{ postsCount }]] = await db.query('SELECT COUNT(*) as postsCount FROM posts WHERE user_id = ? AND deleted_at IS NULL', [id]);
            const [[{ commentsCount }]] = await db.query('SELECT COUNT(*) as commentsCount FROM comments WHERE user_id = ? AND deleted_at IS NULL', [id]);
            const [[{ followersCount }]] = await db.query('SELECT COUNT(*) as followersCount FROM follows WHERE followed_id = ?', [id]);
            const [[{ followingCount }]] = await db.query('SELECT COUNT(*) as followingCount FROM follows WHERE follower_id = ?', [id]);
            const [[{ reportsMade }]] = await db.query('SELECT COUNT(*) as reportsMade FROM reports WHERE reporter_id = ?', [id]);
            const [[{ reportsReceived }]] = await db.query('SELECT COUNT(*) as reportsReceived FROM reports WHERE target_type = "user" AND target_id = ?', [id]);

            // Advertências
            const [warnings] = await db.query(`
                SELECT uw.*, u.name as admin_name
                FROM user_warnings uw
                JOIN users u ON uw.admin_id = u.id
                WHERE uw.user_id = ?
                ORDER BY uw.created_at DESC
            `, [id]);

            // Restrições
            const [restrictions] = await db.query(`
                SELECT ur.*, u.name as admin_name
                FROM user_restrictions ur
                JOIN users u ON ur.admin_id = u.id
                WHERE ur.user_id = ?
                ORDER BY ur.created_at DESC
            `, [id]);

            res.json({
                ...user,
                stats: {
                    postsCount,
                    commentsCount,
                    followersCount,
                    followingCount,
                    reportsMade,
                    reportsReceived
                },
                warnings,
                restrictions
            });
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            res.status(500).json({ error: 'Erro ao buscar usuário' });
        }
    },

    // Bloquear/Desbloquear usuário
    toggleBlock: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { block } = req.body; // true para bloquear, false para desbloquear

            if (parseInt(id) === admin.id) {
                return res.status(400).json({ error: 'Você não pode bloquear a si mesmo' });
            }

            const [users] = await db.query('SELECT id, name, is_blocked FROM users WHERE id = ?', [id]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const user = users[0];
            const newStatus = Boolean(block);

            if (user.is_blocked === newStatus) {
                return res.status(400).json({ error: `Usuário já está ${block ? 'bloqueado' : 'desbloqueado'}` });
            }

            await db.query('UPDATE users SET is_blocked = ? WHERE id = ?', [newStatus, id]);

            // Se bloqueando, remover follows mutuos
            if (block) {
                await db.query('DELETE FROM follows WHERE (follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?)', [id, admin.id, admin.id, id]);
            }

            await logAdminAction(
                admin.id,
                block ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
                'user',
                parseInt(id),
                `${block ? 'Bloqueou' : 'Desbloqueou'} o usuário ${user.name}`,
                null,
                req
            );

            socketHelper.sendToUser(id, 'account_status_changed', { blocked: block });

            res.json({
                message: block ? 'Usuário bloqueado. O login será recusado.' : 'Usuário desbloqueado.',
                is_blocked: newStatus
            });
        } catch (error) {
            console.error('Erro ao bloquear/desbloquear:', error);
            res.status(500).json({ error: 'Erro ao alterar status de bloqueio' });
        }
    },

    // Atualizar role do usuário
    updateRole: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { role, admin_role, unit_id } = req.body;

            if (parseInt(id) === admin.id) {
                return res.status(400).json({ error: 'Você não pode alterar seu próprio role' });
            }

            const [users] = await db.query('SELECT id, name, role, admin_role FROM users WHERE id = ?', [id]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const user = users[0];
            const oldRole = user.role;
            const oldAdminRole = user.admin_role;

            const updates = [];
            const values = [];

            if (role && ['Aluno', 'Professor', 'Administrador'].includes(role)) {
                updates.push('role = ?');
                values.push(role);
            }
            if (admin_role !== undefined) {
                if (admin_role === '' || admin_role === null) {
                    updates.push('admin_role = NULL, unit_id = NULL');
                } else if (['super_admin', 'admin_unidade', 'admin_moderacao', 'admin_suporte'].includes(admin_role)) {
                    updates.push('admin_role = ?');
                    values.push(admin_role);
                    if (admin_role === 'admin_unidade' && unit_id) {
                        updates.push('unit_id = ?');
                        values.push(unit_id);
                    } else if (admin_role !== 'admin_unidade') {
                        updates.push('unit_id = NULL');
                    }
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhuma alteração válida' });
            }

            values.push(id);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query('SELECT id, name, role, admin_role, unit_id FROM users WHERE id = ?', [id]);

            await logAdminAction(
                admin.id,
                'USER_ROLE_UPDATED',
                'user',
                parseInt(id),
                `Alterou role de ${user.name}: ${oldRole} → ${updated[0].role}${updated[0].admin_role ? ` (admin: ${oldAdminRole || 'nenhum'} → ${updated[0].admin_role})` : ''}`,
                { oldRole, newRole: updated[0].role, oldAdminRole, newAdminRole: updated[0].admin_role },
                req
            );

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar role:', error);
            res.status(500).json({ error: 'Erro ao atualizar role do usuário' });
        }
    },

    // Atualizar perfil do usuário (admin editando)
    updateProfile: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { name, email, bio, course, unit, area, state, city, is_private, hide_email } = req.body;

            const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const updates = [];
            const values = [];

            if (name !== undefined) { updates.push('name = ?'); values.push(name); }
            if (email !== undefined) {
                // Verificar se email já existe em outro usuário
                const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
                if (existing.length > 0) {
                    return res.status(400).json({ error: 'E-mail já cadastrado' });
                }
                updates.push('email = ?');
                values.push(email);
            }
            if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
            if (course !== undefined) { updates.push('course = ?'); values.push(course); }
            if (unit !== undefined) { updates.push('unit = ?'); values.push(unit); }
            if (area !== undefined) { updates.push('area = ?'); values.push(area); }
            if (state !== undefined) { updates.push('state = ?'); values.push(state); }
            if (city !== undefined) { updates.push('city = ?'); values.push(city); }
            if (is_private !== undefined) { updates.push('is_private = ?'); values.push(is_private ? 1 : 0); }
            if (hide_email !== undefined) { updates.push('hide_email = ?'); values.push(hide_email ? 1 : 0); }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            values.push(id);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query('SELECT id, name, email, role, bio, course, unit, area, state, city, is_private, hide_email FROM users WHERE id = ?', [id]);

            await logAdminAction(admin.id, 'USER_PROFILE_UPDATED', 'user', parseInt(id), `Editou perfil de ${updated[0].name}`, null, req);

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            res.status(500).json({ error: 'Erro ao atualizar perfil' });
        }
    },

    // Resetar senha do usuário (admin)
    resetPassword: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { new_password } = req.body;

            if (!new_password || new_password.length < 6) {
                return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
            }

            const [users] = await db.query('SELECT id, name FROM users WHERE id = ?', [id]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const hash = await bcrypt.hash(new_password, 10);
            await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);

            await logAdminAction(admin.id, 'USER_PASSWORD_RESET', 'user', parseInt(id), `Resetou senha de ${users[0].name}`, null, req);

            res.json({ message: 'Senha redefinida com sucesso' });
        } catch (error) {
            console.error('Erro ao resetar senha:', error);
            res.status(500).json({ error: 'Erro ao redefinir senha' });
        }
    },

    // Histórico de atividade do usuário
    getActivity: async (req, res) => {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Posts recentes
            const [posts] = await db.query(`
                SELECT 'post' as type, id, content, created_at, 'Criou post' as action
                FROM posts WHERE user_id = ? AND deleted_at IS NULL
                ORDER BY created_at DESC LIMIT 10
            `, [id]);

            // Comentários recentes
            const [comments] = await db.query(`
                SELECT 'comment' as type, c.id, c.content, c.created_at, 'Comentou' as action, p.id as post_id
                FROM comments c
                JOIN posts p ON c.post_id = p.id
                WHERE c.user_id = ? AND c.deleted_at IS NULL
                ORDER BY c.created_at DESC LIMIT 10
            `, [id]);

            // Denúncias feitas
            const [reports] = await db.query(`
                SELECT 'report' as type, r.id, r.reason, r.description, r.created_at, 'Denunciou' as action, r.status
                FROM reports r
                WHERE r.reporter_id = ?
                ORDER BY r.created_at DESC LIMIT 10
            `, [id]);

            // Combinar e ordenar
            const allActivity = [...posts, ...comments, ...reports]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, parseInt(limit));

            res.json({ activity: allActivity });
        } catch (error) {
            console.error('Erro ao buscar atividade:', error);
            res.status(500).json({ error: 'Erro ao buscar atividade do usuário' });
        }
    },

    // Estatísticas gerais de usuários
    getStats: async (req, res) => {
        try {
            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM users');
            const [[{ students }]] = await db.query("SELECT COUNT(*) as students FROM users WHERE role = 'Aluno'");
            const [[{ teachers }]] = await db.query("SELECT COUNT(*) as teachers FROM users WHERE role = 'Professor'");
            const [[{ admins }]] = await db.query('SELECT COUNT(*) as admins FROM users WHERE admin_role IS NOT NULL');
            const [[{ blocked }]] = await db.query('SELECT COUNT(*) as blocked FROM users WHERE is_blocked = 1');
            const [[{ pendingOnboarding }]] = await db.query('SELECT COUNT(*) as pending FROM users WHERE onboarding_completed = 0');
            const [[{ today }]] = await db.query('SELECT COUNT(*) as today FROM users WHERE DATE(created_at) = CURDATE()');
            const [[{ thisWeek }]] = await db.query('SELECT COUNT(*) as thisWeek FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
            const [[{ thisMonth }]] = await db.query('SELECT COUNT(*) as thisMonth FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');

            // Por curso
            const [byCourse] = await db.query(`
                SELECT course, COUNT(*) as count
                FROM users
                WHERE course IS NOT NULL AND role = 'Aluno'
                GROUP BY course
                ORDER BY count DESC
                LIMIT 10
            `);

            // Por unidade
            const [byUnit] = await db.query(`
                SELECT unit, COUNT(*) as count
                FROM users
                WHERE unit IS NOT NULL
                GROUP BY unit
                ORDER BY count DESC
                LIMIT 10
            `);

            // Crescimento (últimos 30 dias)
            const [growth] = await db.query(`
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM users
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `);

            res.json({
                overview: { total, students, teachers, admins, blocked, pendingOnboarding, today, thisWeek, thisMonth },
                byCourse,
                byUnit,
                growth
            });
        } catch (error) {
            console.error('Erro ao buscar stats de usuários:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas' });
        }
    }
};

module.exports = adminUsersController;