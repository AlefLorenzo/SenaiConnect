const db = require('../db');
const socketHelper = require('../socketHelper');
const notificationController = require('./notificationController');
const { logAdminAction } = require('./adminAuthController');

const businessController = {
    // ============================================
    // BUSINESS PROFILE MANAGEMENT
    // ============================================

    // Registrar nova empresa (solicitação de cadastro)
    createBusiness: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                company_name,
                sector,
                location,
                website,
                contact_email,
                contact_phone,
                address,
                cnpj,
                description
            } = req.body;

            if (!company_name) {
                return res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
            }

            // Verificar se usuário já possui empresa
            const [existing] = await db.query('SELECT id FROM businesses WHERE owner_user_id = ?', [userId]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Você já possui uma empresa cadastrada.' });
            }

            // Gerar slug único
            const baseSlug = company_name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

            let slug = baseSlug;
            let counter = 1;
            while (true) {
                const [slugExists] = await db.query('SELECT id FROM businesses WHERE slug = ?', [slug]);
                if (slugExists.length === 0) break;
                slug = `${baseSlug}-${counter++}`;
            }

            // Criar empresa com status pendente
            const [result] = await db.query(
                `INSERT INTO businesses (owner_user_id, company_name, slug, sector, location, website, contact_email, contact_phone, address, cnpj, description, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [userId, company_name, slug, sector || null, location || null, website || null, contact_email || null, contact_phone || null, address || null, cnpj || null, description || null]
            );

            const [business] = await db.query('SELECT * FROM businesses WHERE id = ?', [result.insertId]);

            // Marcar usuário como business owner
            await db.query('UPDATE users SET is_business_owner = 1, business_id = ? WHERE id = ?', [result.insertId, userId]);

            // Notificar admins
            const [admins] = await db.query('SELECT id FROM users WHERE admin_role IS NOT NULL AND is_blocked = 0');
            for (const admin of admins) {
                await notificationController.createNotification(
                    admin.id,
                    'business_registration',
                    userId,
                    null,
                    `Nova empresa "${company_name}" solicitou cadastro.`
                );
                socketHelper.sendToUser(admin.id, 'new_business_registration', {
                    businessId: result.insertId,
                    companyName: company_name
                });
            }

            res.status(201).json({
                ...business[0],
                message: 'Empresa cadastrada com sucesso! Aguardando aprovação administrativa.'
            });
        } catch (error) {
            console.error('Erro ao criar empresa:', error);
            res.status(500).json({ error: 'Erro ao cadastrar empresa.' });
        }
    },

    // Obter perfil da empresa logada
    getMyBusiness: async (req, res) => {
        try {
            const userId = req.user.id;

            const [business] = await db.query('SELECT * FROM businesses WHERE owner_user_id = ?', [userId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Você não possui uma empresa cadastrada.' });
            }

            // Estatísticas
            const [[{ followers_count }]] = await db.query('SELECT COUNT(*) as followers_count FROM business_followers WHERE business_id = ?', [business[0].id]);
            const [[{ posts_count }]] = await db.query("SELECT COUNT(*) as posts_count FROM business_posts WHERE business_id = ? AND status = 'published'", [business[0].id]);
            const [[{ campaigns_count }]] = await db.query("SELECT COUNT(*) as campaigns_count FROM business_campaigns WHERE business_id = ?", [business[0].id]);

            res.json({
                ...business[0],
                followers_count,
                posts_count,
                campaigns_count
            });
        } catch (error) {
            console.error('Erro ao buscar minha empresa:', error);
            res.status(500).json({ error: 'Erro ao buscar empresa.' });
        }
    },

    // Obter perfil público de uma empresa
    getBusiness: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            const [businesses] = await db.query('SELECT * FROM businesses WHERE id = ? AND status = ?', [id, 'approved']);
            if (businesses.length === 0) {
                return res.status(404).json({ error: 'Empresa não encontrada.' });
            }

            const business = businesses[0];

            // Verificar se usuário segue
            let is_following = false;
            if (userId) {
                const [follows] = await db.query('SELECT 1 FROM business_followers WHERE business_id = ? AND user_id = ?', [id, userId]);
                is_following = follows.length > 0;
            }

            // Estatísticas
            const [[{ followers_count }]] = await db.query('SELECT COUNT(*) as followers_count FROM business_followers WHERE business_id = ?', [id]);
            const [[{ posts_count }]] = await db.query("SELECT COUNT(*) as posts_count FROM business_posts WHERE business_id = ? AND status = 'published'", [id]);

            res.json({
                ...business,
                followers_count,
                posts_count,
                is_following
            });
        } catch (error) {
            console.error('Erro ao buscar empresa:', error);
            res.status(500).json({ error: 'Erro ao buscar empresa.' });
        }
    },

    // Atualizar perfil da empresa
    updateBusiness: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                company_name,
                sector,
                location,
                website,
                social_links,
                contact_email,
                contact_phone,
                address,
                description,
                logo_url,
                cover_image_url
            } = req.body;

            const [business] = await db.query('SELECT * FROM businesses WHERE owner_user_id = ?', [userId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Empresa não encontrada.' });
            }

            const updates = [];
            const values = [];

            if (company_name !== undefined) { updates.push('company_name = ?'); values.push(company_name); }
            if (sector !== undefined) { updates.push('sector = ?'); values.push(sector); }
            if (location !== undefined) { updates.push('location = ?'); values.push(location); }
            if (website !== undefined) { updates.push('website = ?'); values.push(website); }
            if (social_links !== undefined) { updates.push('social_links = ?'); values.push(typeof social_links === 'object' ? JSON.stringify(social_links) : social_links); }
            if (contact_email !== undefined) { updates.push('contact_email = ?'); values.push(contact_email); }
            if (contact_phone !== undefined) { updates.push('contact_phone = ?'); values.push(contact_phone); }
            if (address !== undefined) { updates.push('address = ?'); values.push(address); }
            if (description !== undefined) { updates.push('description = ?'); values.push(description); }
            if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url); }
            if (cover_image_url !== undefined) { updates.push('cover_image_url = ?'); values.push(cover_image_url); }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(business[0].id);

            await db.query(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query('SELECT * FROM businesses WHERE id = ?', [business[0].id]);
            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar empresa:', error);
            res.status(500).json({ error: 'Erro ao atualizar empresa.' });
        }
    },

    // Buscar empresas (para feed, busca, etc)
    listBusinesses: async (req, res) => {
        try {
            const userId = req.user?.id;
            const { search, sector, location, page = 1, limit = 20, sort = 'followers' } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE b.status = "approved"';
            const params = [];

            if (search) {
                whereClause += ' AND (b.company_name LIKE ? OR b.description LIKE ? OR b.sector LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (sector) {
                whereClause += ' AND b.sector = ?';
                params.push(sector);
            }
            if (location) {
                whereClause += ' AND b.location LIKE ?';
                params.push(`%${location}%`);
            }

            let orderBy = 'b.followers_count DESC';
            if (sort === 'recent') orderBy = 'b.created_at DESC';
            else if (sort === 'name') orderBy = 'b.company_name ASC';

            const query = `
                SELECT b.*, u.name as owner_name,
                (SELECT COUNT(*) FROM business_followers WHERE business_id = b.id) as followers_count,
                (SELECT COUNT(*) FROM business_posts WHERE business_id = b.id AND status = 'published') as posts_count,
                ${userId ? 'EXISTS(SELECT 1 FROM business_followers WHERE business_id = b.id AND user_id = ?) as is_following' : 'FALSE as is_following'}
                FROM businesses b
                JOIN users u ON b.owner_user_id = u.id
                ${whereClause}
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
            `;
            if (userId) params.push(userId);
            params.push(parseInt(limit), offset);

            const [businesses] = await db.query(query, params);

            // Total para paginação
            const countQuery = `SELECT COUNT(*) as total FROM businesses b ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({
                businesses,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            });
        } catch (error) {
            console.error('Erro ao listar empresas:', error);
            res.status(500).json({ error: 'Erro ao listar empresas.' });
        }
    },

    // ============================================
    // FOLLOW/UNFOLLOW EMPRESAS
    // ============================================

    followBusiness: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id: businessId } = req.params;

            const [business] = await db.query('SELECT id FROM businesses WHERE id = ? AND status = "approved"', [businessId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Empresa não encontrada.' });
            }

            const [existing] = await db.query('SELECT 1 FROM business_followers WHERE business_id = ? AND user_id = ?', [businessId, userId]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Você já segue esta empresa.' });
            }

            await db.query('INSERT INTO business_followers (business_id, user_id) VALUES (?, ?)', [businessId, userId]);
            await db.query('UPDATE businesses SET followers_count = followers_count + 1 WHERE id = ?', [businessId]);

            // Notificar empresa
            const [biz] = await db.query('SELECT owner_user_id, company_name FROM businesses WHERE id = ?', [businessId]);
            if (biz.length > 0) {
                const [user] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
                await notificationController.createNotification(
                    biz[0].owner_user_id,
                    'new_follower',
                    userId,
                    null,
                    `${user[0].name} começou a seguir ${biz[0].company_name}.`
                );
                socketHelper.sendToUser(biz[0].owner_user_id, 'new_business_follower', {
                    businessId: parseInt(businessId),
                    followerName: user[0].name
                });
            }

            // Notificar usuário sobre posts da empresa
            await notificationController.createNotification(
                userId,
                'business_followed',
                null,
                null,
                `Você começou a seguir ${biz[0].company_name}.`
            );

            res.json({ message: 'Empresa seguida com sucesso!', is_following: true });
        } catch (error) {
            console.error('Erro ao seguir empresa:', error);
            res.status(500).json({ error: 'Erro ao seguir empresa.' });
        }
    },

    unfollowBusiness: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id: businessId } = req.params;

            await db.query('DELETE FROM business_followers WHERE business_id = ? AND user_id = ?', [businessId, userId]);
            await db.query('UPDATE businesses SET followers_count = GREATEST(0, followers_count - 1) WHERE id = ?', [businessId]);

            res.json({ message: 'Deixou de seguir a empresa.', is_following: false });
        } catch (error) {
            console.error('Erro ao deixar de seguir:', error);
            res.status(500).json({ error: 'Erro ao deixar de seguir.' });
        }
    },

    // Listar seguidores de uma empresa (para o painel da empresa)
    getBusinessFollowers: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id: businessId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [businessId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Empresa não encontrada.' });
            }
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const query = `
                SELECT u.id, u.name, u.avatar, u.course, u.unit,
                DATE_FORMAT(bf.created_at, '%d/%m/%Y %H:%i') as followed_at
                FROM business_followers bf
                JOIN users u ON bf.user_id = u.id
                WHERE bf.business_id = ?
                ORDER BY bf.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const [followers] = await db.query(query, [businessId, parseInt(limit), offset]);

            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM business_followers WHERE business_id = ?', [businessId]);

            res.json({ followers, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao buscar seguidores:', error);
            res.status(500).json({ error: 'Erro ao buscar seguidores.' });
        }
    },

    // ============================================
    // ADMIN BUSINESS MANAGEMENT
    // ============================================

    adminListBusinesses: async (req, res) => {
        try {
            const { search, status, page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (search) {
                whereClause += ' AND (b.company_name LIKE ? OR b.owner_user_id LIKE ? OR u.email LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            if (status) {
                whereClause += ' AND b.status = ?';
                params.push(status);
            }

            const query = `
                SELECT b.*, u.name as owner_name, u.email as owner_email,
                (SELECT COUNT(*) FROM business_followers WHERE business_id = b.id) as followers_count,
                (SELECT COUNT(*) FROM business_posts WHERE business_id = b.id AND status = 'published') as posts_count
                FROM businesses b
                JOIN users u ON b.owner_user_id = u.id
                ${whereClause}
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);
            const [businesses] = await db.query(query, params);

            const countQuery = `SELECT COUNT(*) as total FROM businesses b JOIN users u ON b.owner_user_id = u.id ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({ businesses, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao listar empresas (admin):', error);
            res.status(500).json({ error: 'Erro ao listar empresas.' });
        }
    },

    adminApproveBusiness: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;

            const [business] = await db.query('SELECT * FROM businesses WHERE id = ?', [id]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Empresa não encontrada.' });
            }

            await db.query('UPDATE businesses SET status = "approved", approved_at = NOW(), approved_by = ? WHERE id = ?', [admin.id, id]);

            // Notificar empresa
            const notificationController = require('./notificationController');
            await notificationController.createNotification(
                business[0].owner_user_id,
                'business_approved',
                admin.id,
                null,
                `Sua empresa "${business[0].company_name}" foi aprovada!`
            );
            socketHelper.sendToUser(business[0].owner_user_id, 'business_status_changed', {
                businessId: parseInt(id),
                status: 'approved'
            });

            // Marcar usuário como business owner
            await db.query('UPDATE users SET is_business_owner = 1, business_id = ? WHERE id = ?', [id, business[0].owner_user_id]);

            await logAdminAction(admin.id, 'BUSINESS_APPROVED', 'business', parseInt(id), `Aprovou a empresa "${business[0].company_name}"`, null, req);

            res.json({ message: 'Empresa aprovada com sucesso!' });
        } catch (error) {
            console.error('Erro ao aprovar empresa:', error);
            res.status(500).json({ error: 'Erro ao aprovar empresa.' });
        }
    },

    adminRejectBusiness: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { reason } = req.body;

            const [business] = await db.query('SELECT * FROM businesses WHERE id = ?', [id]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Empresa não encontrada.' });
            }

            await db.query('UPDATE businesses SET status = "rejected", rejection_reason = ?, approved_by = ? WHERE id = ?', [reason, admin.id, id]);

            // Notificar empresa
            const notificationController = require('./notificationController');
            await notificationController.createNotification(
                business[0].owner_user_id,
                'business_rejected',
                admin.id,
                null,
                `Sua empresa "${business[0].company_name}" não foi aprovada. Motivo: ${reason}`
            );
            socketHelper.sendToUser(business[0].owner_user_id, 'business_status_changed', {
                businessId: parseInt(id),
                status: 'rejected',
                reason
            });

            await logAdminAction(admin.id, 'BUSINESS_REJECTED', 'business', parseInt(id), `Rejeitou a empresa "${business[0].company_name}"`, { reason }, req);

            res.json({ message: 'Empresa rejeitada.' });
        } catch (error) {
            console.error('Erro ao rejeitar empresa:', error);
            res.status(500).json({ error: 'Erro ao rejeitar empresa.' });
        }
    },

    adminSuspendBusiness: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { reason } = req.body;

            await db.query('UPDATE businesses SET status = "suspended" WHERE id = ?', [id]);

            const [business] = await db.query('SELECT * FROM businesses WHERE id = ?', [id]);
            if (business.length > 0) {
                await notificationController.createNotification(
                    business[0].owner_user_id,
                    'business_suspended',
                    admin.id,
                    null,
                    `Sua empresa "${business[0].company_name}" foi suspensa. Motivo: ${reason || 'Não informado'}`
                );
                socketHelper.sendToUser(business[0].owner_user_id, 'business_status_changed', {
                    businessId: parseInt(id),
                    status: 'suspended',
                    reason
                });
            }

            await logAdminAction(admin.id, 'BUSINESS_SUSPENDED', 'business', parseInt(id), `Suspendeu a empresa "${business[0].company_name}"`, { reason }, req);

            res.json({ message: 'Empresa suspensa.' });
        } catch (error) {
            console.error('Erro ao suspender empresa:', error);
            res.status(500).json({ error: 'Erro ao suspender empresa.' });
        }
    },

    adminGetBusinessStats: async (req, res) => {
        try {
            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM businesses');
            const [[{ pending }]] = await db.query("SELECT COUNT(*) as pending FROM businesses WHERE status = 'pending'");
            const [[{ approved }]] = await db.query("SELECT COUNT(*) as approved FROM businesses WHERE status = 'approved'");
            const [[{ rejected }]] = await db.query("SELECT COUNT(*) as rejected FROM businesses WHERE status = 'rejected'");
            const [[{ suspended }]] = await db.query("SELECT COUNT(*) as suspended FROM businesses WHERE status = 'suspended'");
            const [[{ thisMonth }]] = await db.query("SELECT COUNT(*) as thisMonth FROM businesses WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");

            res.json({ total, pending, approved, rejected, suspended, thisMonth });
        } catch (error) {
            console.error('Erro ao buscar stats de empresas:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        }
    }
};

module.exports = businessController;