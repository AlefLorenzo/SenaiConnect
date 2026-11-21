const db = require('../db');
const { logAdminAction } = require('./adminAuthController');

const adSpaceController = {
    // Listar espaços publicitários (público - apenas ativos)
    listAdSpaces: async (req, res) => {
        try {
            const { location } = req.query;

            let whereClause = 'WHERE is_active = 1';
            const params = [];

            if (location) {
                whereClause += ' AND location = ?';
                params.push(location);
            }

            const query = `
                SELECT id, name, slug, description, location, width, height, max_ads, frequency_cap,
                price_cpm, price_cpc, price_fixed
                FROM ad_spaces
                ${whereClause}
                ORDER BY location, name
            `;
            const [spaces] = await db.query(query, params);

            res.json(spaces);
        } catch (error) {
            console.error('Erro ao listar espaços:', error);
            res.status(500).json({ error: 'Erro ao buscar espaços publicitários.' });
        }
    },

    // Obter espaço por ID
    getAdSpace: async (req, res) => {
        try {
            const { id } = req.params;

            const [spaces] = await db.query('SELECT * FROM ad_spaces WHERE id = ?', [id]);
            if (spaces.length === 0) {
                return res.status(404).json({ error: 'Espaço não encontrado.' });
            }

            res.json(spaces[0]);
        } catch (error) {
            console.error('Erro ao buscar espaço:', error);
            res.status(500).json({ error: 'Erro ao buscar espaço.' });
        }
    },

    // ============================================
    // ADMIN AD SPACE MANAGEMENT
    // ============================================

    // Listar todos (admin)
    adminListAdSpaces: async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const query = `
                SELECT a.*,
                (SELECT COUNT(*) FROM campaign_creatives WHERE ad_space_id = a.id AND status = 'approved') as active_campaigns
                FROM ad_spaces a
                ORDER BY a.location, a.name
                LIMIT ? OFFSET ?
            `;
            const [spaces] = await db.query(query, [parseInt(limit), offset]);

            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM ad_spaces');

            res.json({ spaces, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao listar espaços (admin):', error);
            res.status(500).json({ error: 'Erro ao listar espaços.' });
        }
    },

    // Criar novo espaço
    adminCreateAdSpace: async (req, res) => {
        try {
            const admin = req.admin;
            const {
                name,
                slug,
                description,
                location,
                width,
                height,
                max_ads,
                frequency_cap,
                price_cpm,
                price_cpc,
                price_fixed
            } = req.body;

            if (!name || !slug || !location || !width || !height) {
                return res.status(400).json({ error: 'Campos obrigatórios: name, slug, location, width, height.' });
            }

            const validLocations = ['business_feed_top', 'business_feed_middle', 'business_feed_bottom', 'business_stories', 'business_profile', 'business_sidebar', 'dashboard', 'global_feed', 'global_stories', 'notifications'];
            if (!validLocations.includes(location)) {
                return res.status(400).json({ error: 'Localização inválida.' });
            }

            // Verificar slug único
            const [existing] = await db.query('SELECT id FROM ad_spaces WHERE slug = ?', [slug]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Slug já existe.' });
            }

            const [result] = await db.query(
                `INSERT INTO ad_spaces (name, slug, description, location, width, height, max_ads, frequency_cap, price_cpm, price_cpc, price_fixed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, slug, description || '', location, width, height, max_ads || 1, frequency_cap || 3, price_cpm || null, price_cpc || null, price_fixed || null]
            );

            const [space] = await db.query('SELECT * FROM ad_spaces WHERE id = ?', [result.insertId]);

            await logAdminAction(admin.id, 'AD_SPACE_CREATED', 'ad_space', result.insertId, `Criou o espaço publicitário "${name}"`, { location }, req);

            res.status(201).json(space[0]);
        } catch (error) {
            console.error('Erro ao criar espaço:', error);
            res.status(500).json({ error: 'Erro ao criar espaço publicitário.' });
        }
    },

    // Atualizar espaço
    adminUpdateAdSpace: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const {
                name,
                description,
                location,
                width,
                height,
                max_ads,
                frequency_cap,
                price_cpm,
                price_cpc,
                price_fixed,
                is_active
            } = req.body;

            const [space] = await db.query('SELECT * FROM ad_spaces WHERE id = ?', [id]);
            if (space.length === 0) {
                return res.status(404).json({ error: 'Espaço não encontrado.' });
            }

            const updates = [];
            const values = [];

            if (name !== undefined) { updates.push('name = ?'); values.push(name); }
            if (description !== undefined) { updates.push('description = ?'); values.push(description); }
            if (location !== undefined) {
                const validLocations = ['business_feed_top', 'business_feed_middle', 'business_feed_bottom', 'business_stories', 'business_profile', 'business_sidebar', 'dashboard', 'global_feed', 'global_stories', 'notifications'];
                if (!validLocations.includes(location)) {
                    return res.status(400).json({ error: 'Localização inválida.' });
                }
                updates.push('location = ?'); values.push(location);
            }
            if (width !== undefined) { updates.push('width = ?'); values.push(width); }
            if (height !== undefined) { updates.push('height = ?'); values.push(height); }
            if (max_ads !== undefined) { updates.push('max_ads = ?'); values.push(max_ads); }
            if (frequency_cap !== undefined) { updates.push('frequency_cap = ?'); values.push(frequency_cap); }
            if (price_cpm !== undefined) { updates.push('price_cpm = ?'); values.push(price_cpm); }
            if (price_cpc !== undefined) { updates.push('price_cpc = ?'); values.push(price_cpc); }
            if (price_fixed !== undefined) { updates.push('price_fixed = ?'); values.push(price_fixed); }
            if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            await db.query(`UPDATE ad_spaces SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query('SELECT * FROM ad_spaces WHERE id = ?', [id]);

            await logAdminAction(admin.id, 'AD_SPACE_UPDATED', 'ad_space', parseInt(id), `Atualizou o espaço "${updated[0].name}"`, null, req);

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar espaço:', error);
            res.status(500).json({ error: 'Erro ao atualizar espaço.' });
        }
    },

    // Excluir espaço
    adminDeleteAdSpace: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;

            const [space] = await db.query('SELECT * FROM ad_spaces WHERE id = ?', [id]);
            if (space.length === 0) {
                return res.status(404).json({ error: 'Espaço não encontrado.' });
            }

            // Verificar se tem campanhas ativas
            const [creatives] = await db.query('SELECT id FROM campaign_creatives WHERE ad_space_id = ? AND status IN ("pending", "approved")', [id]);
            if (creatives.length > 0) {
                return res.status(400).json({ error: 'Não é possível excluir espaço com campanhas ativas ou pendentes.' });
            }

            await db.query('DELETE FROM ad_spaces WHERE id = ?', [id]);

            await logAdminAction(admin.id, 'AD_SPACE_DELETED', 'ad_space', parseInt(id), `Excluiu o espaço "${space[0].name}"`, null, req);

            res.json({ message: 'Espaço excluído.' });
        } catch (error) {
            console.error('Erro ao excluir espaço:', error);
            res.status(500).json({ error: 'Erro ao excluir espaço.' });
        }
    },

    // Estatísticas do espaço (admin)
    adminGetAdSpaceStats: async (req, res) => {
        try {
            const { id } = req.params;

            const [space] = await db.query('SELECT * FROM ad_spaces WHERE id = ?', [id]);
            if (space.length === 0) {
                return res.status(404).json({ error: 'Espaço não encontrado.' });
            }

            // Impressões dos últimos 30 dias
            const [impressionsByDay] = await db.query(`
                SELECT DATE(viewed_at) as date, COUNT(*) as impressions
                FROM ad_impressions
                WHERE ad_space_id = ?
                AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(viewed_at)
                ORDER BY date ASC
            `, [id]);

            // Clicks dos últimos 30 dias
            const [clicksByDay] = await db.query(`
                SELECT DATE(clicked_at) as date, COUNT(*) as clicks
                FROM ad_clicks
                WHERE ad_space_id = ?
                AND clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(clicked_at)
                ORDER BY date ASC
            `, [id]);

            // Campanhas ativas
            const [activeCampaigns] = await db.query(`
                SELECT bc.id, bc.name, b.company_name, bc.status,
                COUNT(cc.id) as creatives_count
                FROM business_campaigns bc
                JOIN businesses b ON bc.business_id = b.id
                JOIN campaign_creatives cc ON cc.campaign_id = bc.id
                WHERE cc.ad_space_id = ? AND cc.status = 'approved' AND bc.status IN ('active', 'scheduled')
                GROUP BY bc.id
            `, [id]);

            // Receita estimada
            const [[{ estimatedRevenue }]] = await db.query(`
                SELECT SUM(
                    CASE
                        WHEN bc.billing_model = 'CPM' THEN (COUNT(ai.id) / 1000) * bc.cpm_rate
                        WHEN bc.billing_model = 'CPC' THEN COUNT(ac.id) * bc.cpc_rate
                        WHEN bc.billing_model = 'FIXED' THEN bc.fixed_price
                        ELSE 0
                    END
                ) as revenue
                FROM ad_impressions ai
                JOIN business_campaigns bc ON ai.campaign_id = bc.id
                LEFT JOIN ad_clicks ac ON ac.impression_id = ai.id
                WHERE ai.ad_space_id = ? AND ai.viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `, [id]);

            res.json({
                impressions_30d: impressionsByDay,
                clicks_30d: clicksByDay,
                active_campaigns: activeCampaigns,
                estimated_revenue_30d: estimatedRevenue || 0,
                total_impressions_30d: impressionsByDay.reduce((sum, d) => sum + d.impressions, 0),
                total_clicks_30d: clicksByDay.reduce((sum, d) => sum + d.clicks, 0)
            });
        } catch (error) {
            console.error('Erro ao buscar stats do espaço:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        }
    }
};

module.exports = adSpaceController;