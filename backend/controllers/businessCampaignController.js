const db = require('../db');
const socketHelper = require('../socketHelper');
const notificationController = require('./notificationController');
const { logAdminAction } = require('./adminAuthController');

function isSafeCampaignDestination(value) {
    const destination = String(value || '').trim();
    if (!destination || /^(javascript|data|file|vbscript):/i.test(destination)) return false;
    if (destination.startsWith('/') && !destination.startsWith('//') && !destination.includes('\\\\')) return true;
    try {
        const parsed = new URL(destination);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

const businessCampaignController = {
    // ============================================
    // CAMPANHAS - EMPRESA (ANUNCIANTE)
    // ============================================

    // Listar minhas campanhas
    getMyCampaigns: async (req, res) => {
        try {
            const userId = req.user.id;
            const { status, page = 1, limit = 10 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            const [business] = await db.query('SELECT id FROM businesses WHERE owner_user_id = ?', [userId]);
            if (business.length === 0) {
                return res.status(404).json({ error: 'Você não possui uma empresa.' });
            }

            let whereClause = 'WHERE bc.business_id = ?';
            const params = [business[0].id];

            if (status) {
                whereClause += ' AND bc.status = ?';
                params.push(status);
            }

            const query = `
                SELECT bc.*, COUNT(cc.id) as creatives_count
                FROM business_campaigns bc
                LEFT JOIN campaign_creatives cc ON cc.campaign_id = bc.id
                ${whereClause}
                GROUP BY bc.id
                ORDER BY bc.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);

            const [campaigns] = await db.query(query, params);

            // Parse target_audience JSON
            campaigns.forEach(c => {
                if (c.target_audience) {
                    try { c.target_audience = JSON.parse(c.target_audience); } catch { c.target_audience = {}; }
                }
            });

            const countQuery = `SELECT COUNT(*) as total FROM business_campaigns ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({ campaigns, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao buscar minhas campanhas:', error);
            res.status(500).json({ error: 'Erro ao buscar campanhas.' });
        }
    },

    // Obter campanha por ID
    getCampaign: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [campaigns] = await db.query(`
                SELECT bc.*, b.company_name
                FROM business_campaigns bc
                JOIN businesses b ON bc.business_id = b.id
                WHERE bc.id = ?
            `, [id]);
            if (campaigns.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const campaign = campaigns[0];
            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign.business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (campaign.target_audience) {
                try { campaign.target_audience = JSON.parse(campaign.target_audience); } catch { campaign.target_audience = {}; }
            }

            // Criativos
            const [creatives] = await db.query(`
                SELECT cc.*, a.name as ad_space_name, a.location as ad_space_location
                FROM campaign_creatives cc
                JOIN ad_spaces a ON cc.ad_space_id = a.id
                WHERE cc.campaign_id = ?
            `, [id]);

            res.json({ ...campaign, creatives });
        } catch (error) {
            console.error('Erro ao buscar campanha:', error);
            res.status(500).json({ error: 'Erro ao buscar campanha.' });
        }
    },

    // Criar nova campanha
    createCampaign: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                name,
                objective,
                budget,
                billing_model,
                cpm_rate,
                cpc_rate,
                fixed_price,
                target_audience,
                start_date,
                end_date,
                creatives
            } = req.body;

            const [business] = await db.query('SELECT id FROM businesses WHERE owner_user_id = ? AND status = "approved"', [userId]);
            if (business.length === 0) {
                return res.status(403).json({ error: 'Você precisa ter uma empresa aprovada para criar campanhas.' });
            }

            // Validações
            if (!name || !objective || !budget || !billing_model || !start_date || !end_date) {
                return res.status(400).json({ error: 'Campos obrigatórios: name, objective, budget, billing_model, start_date, end_date.' });
            }

            const validObjectives = ['brand_awareness', 'traffic', 'conversions', 'leads', 'engagement'];
            if (!validObjectives.includes(objective)) {
                return res.status(400).json({ error: 'Objetivo inválido.' });
            }

            const validModels = ['CPM', 'CPC', 'FIXED'];
            if (!validModels.includes(billing_model)) {
                return res.status(400).json({ error: 'Modelo de cobrança inválido.' });
            }

            if (billing_model === 'CPM' && !cpm_rate) {
                return res.status(400).json({ error: 'Taxa CPM é obrigatória para modelo CPM.' });
            }
            if (billing_model === 'CPC' && !cpc_rate) {
                return res.status(400).json({ error: 'Taxa CPC é obrigatória para modelo CPC.' });
            }
            if (billing_model === 'FIXED' && !fixed_price) {
                return res.status(400).json({ error: 'Preço fixo é obrigatório para modelo FIXED.' });
            }

            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
                return res.status(400).json({ error: 'A data de início deve ser válida e anterior à data de término.' });
            }
            if (!Array.isArray(creatives) || creatives.length === 0) {
                return res.status(400).json({ error: 'Adicione pelo menos uma peça publicitária antes de criar a campanha.' });
            }
            for (const creative of creatives) {
                if (!creative.ad_space_id || !creative.image_url || !isSafeCampaignDestination(creative.destination_url)) {
                    return res.status(400).json({ error: 'Cada anúncio precisa de uma imagem, um espaço publicitário e um destino HTTP(S) ou caminho interno válido.' });
                }
            }

            const [result] = await db.query(
                `INSERT INTO business_campaigns (business_id, name, objective, budget, billing_model, cpm_rate, cpc_rate, fixed_price, target_audience, start_date, end_date, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
                [
                    business[0].id,
                    name,
                    objective,
                    budget,
                    billing_model,
                    cpm_rate || null,
                    cpc_rate || null,
                    fixed_price || null,
                    target_audience ? JSON.stringify(target_audience) : null,
                    start_date,
                    end_date
                ]
            );

            // Criar criativos se fornecidos
            if (creatives && Array.isArray(creatives)) {
                for (const creative of creatives) {
                    await db.query(
                        `INSERT INTO campaign_creatives (campaign_id, ad_space_id, title, description, image_url, destination_url, width, height)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [result.insertId, creative.ad_space_id, creative.title, creative.description, creative.image_url, creative.destination_url, creative.width, creative.height]
                    );
                }
            }

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [result.insertId]);
            if (campaign[0].target_audience) {
                try { campaign[0].target_audience = JSON.parse(campaign[0].target_audience); } catch { campaign[0].target_audience = {}; }
            }

            res.status(201).json(campaign[0]);
        } catch (error) {
            console.error('Erro ao criar campanha:', error);
            res.status(500).json({ error: 'Erro ao criar campanha.' });
        }
    },

    // Atualizar campanha
    updateCampaign: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const {
                name,
                objective,
                budget,
                billing_model,
                cpm_rate,
                cpc_rate,
                fixed_price,
                target_audience,
                start_date,
                end_date
            } = req.body;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            // Não permitir editar campanhas ativas/completadas (apenas rascunho, agendada, pausada)
            const nonEditableStatuses = ['active', 'completed'];
            if (nonEditableStatuses.includes(campaign[0].status)) {
                return res.status(400).json({ error: 'Não é possível editar campanhas ativas ou finalizadas.' });
            }

            const updates = [];
            const values = [];

            if (name !== undefined) { updates.push('name = ?'); values.push(name); }
            if (objective !== undefined) { updates.push('objective = ?'); values.push(objective); }
            if (budget !== undefined) { updates.push('budget = ?'); values.push(budget); }
            if (billing_model !== undefined) { updates.push('billing_model = ?'); values.push(billing_model); }
            if (cpm_rate !== undefined) { updates.push('cpm_rate = ?'); values.push(cpm_rate); }
            if (cpc_rate !== undefined) { updates.push('cpc_rate = ?'); values.push(cpc_rate); }
            if (fixed_price !== undefined) { updates.push('fixed_price = ?'); values.push(fixed_price); }
            if (target_audience !== undefined) { updates.push('target_audience = ?'); values.push(typeof target_audience === 'object' ? JSON.stringify(target_audience) : target_audience); }
            if (start_date !== undefined) { updates.push('start_date = ?'); values.push(start_date); }
            if (end_date !== undefined) { updates.push('end_date = ?'); values.push(end_date); }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            await db.query(`UPDATE business_campaigns SET ${updates.join(', ')} WHERE id = ?`, values);

            const [updated] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (updated[0].target_audience) {
                try { updated[0].target_audience = JSON.parse(updated[0].target_audience); } catch { updated[0].target_audience = {}; }
            }

            res.json(updated[0]);
        } catch (error) {
            console.error('Erro ao atualizar campanha:', error);
            res.status(500).json({ error: 'Erro ao atualizar campanha.' });
        }
    },

    // Enviar campanha para aprovação
    submitForApproval: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (business[0].owner_user_id !== userId) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (campaign[0].status !== 'draft') {
                return res.status(400).json({ error: 'Apenas campanhas em rascunho podem ser enviadas para aprovação.' });
            }

            // O criativo fica pendente até a revisão administrativa.
            const [creatives] = await db.query(
                'SELECT id, image_url, destination_url FROM campaign_creatives WHERE campaign_id = ?',
                [id]
            );
            if (creatives.length === 0 || creatives.some(creative =>
                !creative.image_url || !isSafeCampaignDestination(creative.destination_url)
            )) {
                return res.status(400).json({ error: 'A campanha precisa ter pelo menos um anúncio válido, com imagem e destino seguro.' });
            }

            await db.query('UPDATE business_campaigns SET status = "pending_approval", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

            // Notificar admins
            const [admins] = await db.query('SELECT id FROM users WHERE admin_role IS NOT NULL AND is_blocked = 0');
            for (const admin of admins) {
                await notificationController.createNotification(
                    admin.id,
                    'campaign_submitted',
                    userId,
                    `Nova campanha "${campaign[0].name}" aguarda aprovação.`,
                    'business_campaign',
                    parseInt(id),
                    null,
                    { resource: 'business_campaign', campaignId: parseInt(id) }
                );
                socketHelper.sendToUser(admin.id, 'campaign_pending_approval', {
                    campaignId: parseInt(id),
                    campaignName: campaign[0].name
                });
            }

            res.json({ message: 'Campanha enviada para aprovação!' });
        } catch (error) {
            console.error('Erro ao enviar para aprovação:', error);
            res.status(500).json({ error: 'Erro ao enviar para aprovação.' });
        }
    },

    // Pausar/Reativar campanha
    togglePause: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { pause } = req.body;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (campaign[0].status === 'completed' || campaign[0].status === 'rejected') {
                return res.status(400).json({ error: 'Não é possível pausar/reattivar campanhas finalizadas ou rejeitadas.' });
            }

            const newStatus = pause ? 'paused' : 'active';
            await db.query('UPDATE business_campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

            res.json({ message: pause ? 'Campanha pausada.' : 'Campanha reativada.', status: newStatus });
        } catch (error) {
            console.error('Erro ao pausar campanha:', error);
            res.status(500).json({ error: 'Erro ao alterar status da campanha.' });
        }
    },

    // Excluir campanha (apenas rascunho/rejeitada)
    deleteCampaign: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const deletableStatuses = ['draft', 'rejected'];
            if (!deletableStatuses.includes(campaign[0].status)) {
                return res.status(400).json({ error: 'Apenas campanhas em rascunho ou rejeitadas podem ser excluídas.' });
            }

            await db.query('DELETE FROM campaign_creatives WHERE campaign_id = ?', [id]);
            await db.query('DELETE FROM business_campaigns WHERE id = ?', [id]);

            res.json({ message: 'Campanha excluída.' });
        } catch (error) {
            console.error('Erro ao excluir campanha:', error);
            res.status(500).json({ error: 'Erro ao excluir campanha.' });
        }
    },

    // Estatísticas da campanha
    getCampaignStats: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const [business] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (business[0].owner_user_id !== userId && req.user.admin_role === undefined) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            // Impressões por dia
            const [impressionsByDay] = await db.query(`
                SELECT DATE(viewed_at) as date, COUNT(*) as impressions
                FROM ad_impressions
                WHERE campaign_id = ?
                AND viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(viewed_at)
                ORDER BY date ASC
            `, [id]);

            // Clicks por dia
            const [clicksByDay] = await db.query(`
                SELECT DATE(clicked_at) as date, COUNT(*) as clicks
                FROM ad_clicks
                WHERE campaign_id = ?
                AND clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(clicked_at)
                ORDER BY date ASC
            `, [id]);

            // Por espaço publicitário
            const [bySpace] = await db.query(`
                SELECT a.name as space_name, a.location,
                COUNT(DISTINCT ai.id) as impressions,
                COUNT(DISTINCT ac.id) as clicks,
                ROUND(COUNT(DISTINCT ac.id) / NULLIF(COUNT(DISTINCT ai.id), 0) * 100, 2) as ctr
                FROM ad_impressions ai
                JOIN ad_spaces a ON ai.ad_space_id = a.id
                LEFT JOIN ad_clicks ac ON ac.impression_id = ai.id
                WHERE ai.campaign_id = ?
                GROUP BY a.id
            `, [id]);

            // CTR atual
            const ctr = campaign[0].impressions_count > 0
                ? (campaign[0].clicks_count / campaign[0].impressions_count * 100).toFixed(2)
                : 0;

            res.json({
                impressions_count: campaign[0].impressions_count,
                clicks_count: campaign[0].clicks_count,
                spent: campaign[0].spent,
                budget: campaign[0].budget,
                budget_usage: ((campaign[0].spent / campaign[0].budget) * 100).toFixed(1),
                ctr: parseFloat(ctr),
                impressions_by_day: impressionsByDay,
                clicks_by_day: clicksByDay,
                by_space: bySpace
            });
        } catch (error) {
            console.error('Erro ao buscar stats da campanha:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        }
    },

    // ============================================
    // ADMIN CAMPANHA MANAGEMENT
    // ============================================

    adminListCampaigns: async (req, res) => {
        try {
            const { search, status, businessId, page = 1, limit = 20 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (search) {
                whereClause += ' AND (bc.name LIKE ? OR b.company_name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            if (status) {
                whereClause += ' AND bc.status = ?';
                params.push(status);
            }
            if (businessId) {
                whereClause += ' AND bc.business_id = ?';
                params.push(businessId);
            }

            const query = `
                SELECT bc.*, b.company_name
                FROM business_campaigns bc
                JOIN businesses b ON bc.business_id = b.id
                ${whereClause}
                ORDER BY bc.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), offset);
            const [campaigns] = await db.query(query, params);
            for (const campaign of campaigns) {
                const [creatives] = await db.query(`
                    SELECT cc.*, a.name AS ad_space_name, a.location AS ad_space_location
                    FROM campaign_creatives cc
                    LEFT JOIN ad_spaces a ON a.id = cc.ad_space_id
                    WHERE cc.campaign_id = ?
                    ORDER BY cc.created_at ASC
                `, [campaign.id]);
                campaign.creatives = creatives;
                if (campaign.target_audience) {
                    try { campaign.target_audience = JSON.parse(campaign.target_audience); } catch { campaign.target_audience = {}; }
                }
            }

            const countQuery = `SELECT COUNT(*) as total FROM business_campaigns bc JOIN businesses b ON bc.business_id = b.id ${whereClause}`;
            const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

            res.json({ campaigns, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
        } catch (error) {
            console.error('Erro ao listar campanhas (admin):', error);
            res.status(500).json({ error: 'Erro ao listar campanhas.' });
        }
    },

    adminApproveCampaign: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            // A aprovação da campanha também aprova seus criativos pendentes.
            const [creatives] = await db.query(
                'SELECT id, image_url, destination_url FROM campaign_creatives WHERE campaign_id = ?',
                [id]
            );
            if (creatives.length === 0 || creatives.some(creative =>
                !creative.image_url || !isSafeCampaignDestination(creative.destination_url)
            )) {
                return res.status(400).json({ error: 'A campanha precisa ter pelo menos um criativo com imagem e destino seguro.' });
            }

            await db.query(
                "UPDATE campaign_creatives SET status = 'approved' WHERE campaign_id = ? AND status IN ('pending', 'approved')",
                [id]
            );
            await db.query('UPDATE business_campaigns SET status = "approved", approved_at = NOW(), approved_by = ? WHERE id = ?', [admin.id, id]);

            // Notificar empresa
            const [biz] = await db.query('SELECT owner_user_id, company_name FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (biz.length > 0) {
                await notificationController.createNotification(
                    biz[0].owner_user_id,
                    'campaign_approved',
                    admin.id,
                    `Sua campanha "${campaign[0].name}" foi aprovada e está pronta para veiculação!`,
                    'business_campaign',
                    parseInt(id),
                    null,
                    { resource: 'business_campaign', campaignId: parseInt(id) }
                );
                socketHelper.sendToUser(biz[0].owner_user_id, 'campaign_status_changed', {
                    campaignId: parseInt(id),
                    status: 'approved'
                });
            }

            await logAdminAction(admin.id, 'CAMPAIGN_APPROVED', 'business_campaign', parseInt(id), `Aprovou a campanha "${campaign[0].name}"`, null, req);

            res.json({ message: 'Campanha aprovada!' });
        } catch (error) {
            console.error('Erro ao aprovar campanha:', error);
            res.status(500).json({ error: 'Erro ao aprovar campanha.' });
        }
    },

    adminRejectCampaign: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { reason } = req.body;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            await db.query('UPDATE business_campaigns SET status = "rejected", rejection_reason = ?, approved_by = ? WHERE id = ?', [reason, admin.id, id]);

            const [biz] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (biz.length > 0) {
                await notificationController.createNotification(
                    biz[0].owner_user_id,
                    'campaign_rejected',
                    admin.id,
                    `Sua campanha "${campaign[0].name}" foi rejeitada. Motivo: ${reason}`,
                    'business_campaign',
                    parseInt(id),
                    null,
                    { resource: 'business_campaign', campaignId: parseInt(id), reason: reason || null }
                );
                socketHelper.sendToUser(biz[0].owner_user_id, 'campaign_status_changed', {
                    campaignId: parseInt(id),
                    status: 'rejected',
                    reason
                });
            }

            await logAdminAction(admin.id, 'CAMPAIGN_REJECTED', 'business_campaign', parseInt(id), `Rejeitou a campanha "${campaign[0].name}"`, { reason }, req);

            res.json({ message: 'Campanha rejeitada.' });
        } catch (error) {
            console.error('Erro ao rejeitar campanha:', error);
            res.status(500).json({ error: 'Erro ao rejeitar campanha.' });
        }
    },

    adminPauseCampaign: async (req, res) => {
        try {
            const admin = req.admin;
            const { id } = req.params;
            const { pause } = req.body;

            const [campaign] = await db.query('SELECT * FROM business_campaigns WHERE id = ?', [id]);
            if (campaign.length === 0) {
                return res.status(404).json({ error: 'Campanha não encontrada.' });
            }

            const newStatus = pause ? 'paused' : 'active';
            await db.query('UPDATE business_campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

            const [biz] = await db.query('SELECT owner_user_id FROM businesses WHERE id = ?', [campaign[0].business_id]);
            if (biz.length > 0) {
                socketHelper.sendToUser(biz[0].owner_user_id, 'campaign_status_changed', {
                    campaignId: parseInt(id),
                    status: newStatus
                });
            }

            await logAdminAction(admin.id, pause ? 'CAMPAIGN_PAUSED' : 'CAMPAIGN_REACTIVATED', 'business_campaign', parseInt(id), `${pause ? 'Pausou' : 'Reativou'} a campanha "${campaign[0].name}"`, null, req);

            res.json({ message: pause ? 'Campanha pausada.' : 'Campanha reativada.', status: newStatus });
        } catch (error) {
            console.error('Erro ao pausar campanha:', error);
            res.status(500).json({ error: 'Erro ao alterar status da campanha.' });
        }
    },

    // Estatísticas gerais de campanhas (admin)
    adminGetCampaignStats: async (req, res) => {
        try {
            const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM business_campaigns');
            const [[{ draft }]] = await db.query("SELECT COUNT(*) as draft FROM business_campaigns WHERE status = 'draft'");
            const [[{ pending }]] = await db.query("SELECT COUNT(*) as pending FROM business_campaigns WHERE status = 'pending_approval'");
            const [[{ approved }]] = await db.query("SELECT COUNT(*) as approved FROM business_campaigns WHERE status = 'approved'");
            const [[{ active }]] = await db.query("SELECT COUNT(*) as active FROM business_campaigns WHERE status = 'active'");
            const [[{ paused }]] = await db.query("SELECT COUNT(*) as paused FROM business_campaigns WHERE status = 'paused'");
            const [[{ completed }]] = await db.query("SELECT COUNT(*) as completed FROM business_campaigns WHERE status = 'completed'");
            const [[{ rejected }]] = await db.query("SELECT COUNT(*) as rejected FROM business_campaigns WHERE status = 'rejected'");
            const [[{ totalBudget }]] = await db.query("SELECT SUM(budget) as totalBudget FROM business_campaigns");
            const [[{ totalSpent }]] = await db.query("SELECT SUM(spent) as totalSpent FROM business_campaigns");

            res.json({
                total, draft, pending, approved, active, paused, completed, rejected,
                totalBudget: totalBudget || 0,
                totalSpent: totalSpent || 0
            });
        } catch (error) {
            console.error('Erro ao buscar stats de campanhas (admin):', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        }
    }
};

module.exports = businessCampaignController;