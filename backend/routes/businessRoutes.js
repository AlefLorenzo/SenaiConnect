const express = require('express');
const router = express.Router();
const db = require('../db');
const businessController = require('../controllers/businessController');
const businessPostController = require('../controllers/businessPostController');
const businessStoryController = require('../controllers/businessStoryController');
const businessCampaignController = require('../controllers/businessCampaignController');
const adSpaceController = require('../controllers/adSpaceController');
const businessNotificationController = require('../controllers/businessNotificationController');
const { requireAdmin, requireRole, JWT_ADMIN_SECRET } = require('../middlewares/adminAuth');
const { authenticateToken } = require('../middlewares/auth');
const rateLimiter = require('../utils/rateLimiter');

// Rate limiter para ações de negócios
const businessActionLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    max: 30,
    message: 'Muitas requisições. Tente novamente em um minuto.'
});

const businessCreateLimiter = rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: 'Limite de criação excedido. Tente novamente mais tarde.'
});

const ANALYTICS_PERIODS = Object.freeze({ '7d': 7, '30d': 30, '90d': 90 });

async function getOwnedBusinessId(userId) {
    const [rows] = await db.query(
        'SELECT id FROM businesses WHERE owner_user_id = ? LIMIT 1',
        [userId]
    );
    return rows[0]?.id || null;
}

async function getBusinessAnalytics(req, res) {
    try {
        const businessId = await getOwnedBusinessId(req.user.id);
        if (!businessId) return res.status(404).json({ error: 'Você ainda não possui uma empresa cadastrada.' });

        const periodKey = String(req.query.period || '30d');
        const periodDays = ANALYTICS_PERIODS[periodKey] || 30;
        const interval = periodDays + ' days';

        const [totals, daily, posts, campaigns] = await Promise.all([
            db.query(
                \`SELECT
                    (SELECT COUNT(*) FROM ad_impressions WHERE business_id = ? AND is_valid = TRUE AND viewed_at >= NOW() - INTERVAL '\${interval}') AS impressions,
                    (SELECT COUNT(*) FROM ad_clicks WHERE business_id = ? AND is_valid = TRUE AND clicked_at >= NOW() - INTERVAL '\${interval}') AS clicks,
                    (SELECT COUNT(*) FROM business_followers WHERE business_id = ?) AS followers,
                    (SELECT COUNT(*) FROM business_posts WHERE business_id = ? AND status = 'published') AS posts,
                    (SELECT COUNT(*) FROM business_stories WHERE business_id = ? AND expires_at > NOW()) AS stories,
                    (SELECT COUNT(*) FROM business_campaigns WHERE business_id = ?) AS campaigns,
                    (SELECT COALESCE(SUM(spent), 0) FROM business_campaigns WHERE business_id = ?) AS spent\`,
                [businessId, businessId, businessId, businessId, businessId, businessId, businessId]
            ),
            db.query(
                \`WITH days AS (
                    SELECT generate_series(
                        date_trunc('day', NOW() - INTERVAL '\${interval}'),
                        date_trunc('day', NOW()),
                        INTERVAL '1 day'
                    ) AS day
                ),
                impressions AS (
                    SELECT date_trunc('day', viewed_at) AS day, COUNT(*)::int AS total
                    FROM ad_impressions
                    WHERE business_id = ? AND is_valid = TRUE
                      AND viewed_at >= NOW() - INTERVAL '\${interval}'
                    GROUP BY 1
                ),
                clicks AS (
                    SELECT date_trunc('day', clicked_at) AS day, COUNT(*)::int AS total
                    FROM ad_clicks
                    WHERE business_id = ? AND is_valid = TRUE
                      AND clicked_at >= NOW() - INTERVAL '\${interval}'
                    GROUP BY 1
                )
                SELECT
                    to_char(days.day, 'DD/MM') AS label,
                    COALESCE(impressions.total, 0)::int AS impressions,
                    COALESCE(clicks.total, 0)::int AS clicks,
                    CASE WHEN COALESCE(impressions.total, 0) = 0 THEN 0
                         ELSE ROUND((COALESCE(clicks.total, 0)::numeric / impressions.total) * 100, 2)
                    END AS ctr
                FROM days
                LEFT JOIN impressions ON impressions.day = days.day
                LEFT JOIN clicks ON clicks.day = days.day
                ORDER BY days.day\`,
                [businessId, businessId]
            ),
            db.query(
                \`SELECT id, content, post_type, views_count, likes_count, comments_count
                 FROM business_posts
                 WHERE business_id = ? AND created_at >= NOW() - INTERVAL '\${interval}'
                 ORDER BY (likes_count + comments_count + shares_count) DESC, created_at DESC
                 LIMIT 5\`,
                [businessId]
            ),
            db.query(
                \`SELECT id, name, billing_model,
                        impressions_count AS impressions,
                        clicks_count AS clicks,
                        ctr,
                        spent
                 FROM business_campaigns
                 WHERE business_id = ? AND created_at >= NOW() - INTERVAL '\${interval}'
                 ORDER BY clicks_count DESC, created_at DESC
                 LIMIT 5\`,
                [businessId]
            )
        ]);

        const summary = totals[0][0] || {};
        const dailyRows = daily[0];
        const impressions = Number(summary.impressions || 0);
        const clicks = Number(summary.clicks || 0);

        return res.json({
            overview: {
                impressions,
                clicks,
                ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
                spent: Number(summary.spent || 0),
                followers: Number(summary.followers || 0),
                posts: Number(summary.posts || 0),
                stories: Number(summary.stories || 0),
                campaigns: Number(summary.campaigns || 0)
            },
            impressionsChart: {
                labels: dailyRows.map((row) => row.label),
                datasets: [{ label: 'Impressões', data: dailyRows.map((row) => Number(row.impressions)) }]
            },
            ctrChart: {
                labels: dailyRows.map((row) => row.label),
                datasets: [{ label: 'CTR (%)', data: dailyRows.map((row) => Number(row.ctr)) }]
            },
            // Não existe histórico diário de gastos no esquema atual; não inventamos uma série.
            spentChart: { labels: [], datasets: [] },
            topPosts: posts[0].map((row) => ({
                ...row,
                views_count: Number(row.views_count || 0),
                likes_count: Number(row.likes_count || 0),
                comments_count: Number(row.comments_count || 0)
            })),
            topCampaigns: campaigns[0].map((row) => ({
                ...row,
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                ctr: Number(row.ctr || 0),
                spent: Number(row.spent || 0)
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar analytics da empresa:', error);
        return res.status(500).json({ error: 'Não foi possível carregar os dados de desempenho da empresa.' });
    }
}

async function getBusinessBilling(req, res) {
    try {
        const businessId = await getOwnedBusinessId(req.user.id);
        if (!businessId) return res.status(404).json({ error: 'Você ainda não possui uma empresa cadastrada.' });

        const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
        const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;

        const [invoiceRows, countRows, summaryRows] = await Promise.all([
            db.query(
                \`SELECT invoices.*,
                        business_campaigns.name AS campaign_name
                 FROM invoices
                 LEFT JOIN business_campaigns
                   ON business_campaigns.id = invoices.campaign_id
                 WHERE invoices.business_id = ?
                 ORDER BY invoices.created_at DESC
                 LIMIT ? OFFSET ?\`,
                [businessId, limit, offset]
            ),
            db.query('SELECT COUNT(*) AS total FROM invoices WHERE business_id = ?', [businessId]),
            db.query(
                \`SELECT
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS "totalPaid",
                    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS "totalPending",
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS "totalRevenue",
                    COALESCE(SUM(CASE WHEN status = 'paid'
                        AND paid_at >= date_trunc('month', NOW())
                        AND paid_at < date_trunc('month', NOW()) + INTERVAL '1 month'
                        THEN amount ELSE 0 END), 0) AS "thisMonth"
                 FROM invoices
                 WHERE business_id = ?\`,
                [businessId]
            )
        ]);

        const total = Number(countRows[0][0]?.total || 0);
        return res.json({
            invoices: invoiceRows[0],
            summary: Object.fromEntries(
                Object.entries(summaryRows[0][0] || {}).map(([key, value]) => [key, Number(value || 0)])
            ),
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (error) {
        console.error('Erro ao buscar faturamento da empresa:', error);
        return res.status(500).json({ error: 'Não foi possível carregar as faturas da empresa.' });
    }
}

function escapePdfText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^\\x20-\\x7E]/g, '')
        .replace(/([\\\\()])/g, '\\\\$1');
}

function createInvoicePdf(invoice) {
    const lines = [
        'SENAI CONNECT - FATURA',
        'Numero: ' + invoice.invoice_number,
        'Empresa: ' + invoice.company_name,
        'Campanha: ' + (invoice.campaign_name || 'Fatura avulsa'),
        'Valor: R$ ' + Number(invoice.amount || 0).toFixed(2),
        'Status: ' + invoice.status,
        'Vencimento: ' + (invoice.due_date || 'Nao informado'),
        'Periodo: ' + (invoice.billing_period_start || '-') + ' ate ' + (invoice.billing_period_end || '-'),
        'Forma de pagamento: ' + (invoice.payment_method || 'Nao informado'),
        'Emitida em: ' + invoice.created_at
    ];

    const commands = ['BT', '/F1 16 Tf', '50 790 Td', '(' + escapePdfText(lines[0]) + ') Tj', '/F1 10 Tf'];
    for (const line of lines.slice(1)) commands.push('0 -28 Td', '(' + escapePdfText(line) + ') Tj');
    commands.push('ET');
    const stream = commands.join('\\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\\nstream\\n' + stream + '\\nendstream'
    ];

    let pdf = '%PDF-1.4\\n';
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf, 'ascii'));
        pdf += (index + 1) + ' 0 obj\\n' + object + '\\nendobj\\n';
    });
    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += 'xref\\n0 ' + (objects.length + 1) + '\\n0000000000 65535 f \\n';
    for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, '0') + ' 00000 n \\n';
    pdf += 'trailer\\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\\nstartxref\\n' + xrefOffset + '\\n%%EOF';
    return Buffer.from(pdf, 'ascii');
}

async function downloadBusinessInvoice(req, res) {
    try {
        const [rows] = await db.query(
            \`SELECT invoices.*, businesses.company_name,
                    business_campaigns.name AS campaign_name
             FROM invoices
             JOIN businesses ON businesses.id = invoices.business_id
             LEFT JOIN business_campaigns ON business_campaigns.id = invoices.campaign_id
             WHERE invoices.id = ? AND invoices.business_id = businesses.id
               AND businesses.owner_user_id = ?
             LIMIT 1\`,
            [req.params.id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada para esta empresa.' });

        const pdf = createInvoicePdf(rows[0]);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="fatura-' + rows[0].id + '.pdf"');
        res.setHeader('Content-Length', String(pdf.length));
        return res.status(200).send(pdf);
    } catch (error) {
        console.error('Erro ao gerar PDF da fatura:', error);
        return res.status(500).json({ error: 'Não foi possível gerar o PDF desta fatura.' });
    }
}


// ============================================
// ROTAS PÚBLICAS (Feed, Busca, Perfis)
// ============================================

// Feed de publicações empresariais
router.get('/posts', authenticateToken, businessPostController.listPosts);
router.get('/feed', authenticateToken, businessPostController.listPosts);
router.get('/', authenticateToken, businessController.listBusinesses);
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DISTINCT sector AS category FROM businesses " +
            "WHERE status = 'approved' AND sector IS NOT NULL AND BTRIM(sector) <> '' ORDER BY sector"
        );
        return res.json(rows.map((row) => row.category));
    } catch (error) {
        console.error('Erro ao listar categorias empresariais:', error);
        return res.status(500).json({ error: 'Não foi possível buscar as categorias.' });
    }
});
router.get('/posts/:id', authenticateToken, businessPostController.getPost);
router.post('/posts', authenticateToken, businessCreateLimiter, businessPostController.createPost);
router.put('/posts/:id', authenticateToken, businessPostController.updatePost);
router.delete('/posts/:id', authenticateToken, businessPostController.deletePost);

// Stories empresariais
router.get('/stories', authenticateToken, businessStoryController.getAll);

// Buscar empresas
router.get('/businesses', authenticateToken, businessController.listBusinesses);

// Perfil público de empresa
router.get('/businesses/:id', authenticateToken, businessController.getBusiness);

// Espaços publicitários disponíveis
router.get('/ad-spaces', authenticateToken, adSpaceController.listAdSpaces);
router.get('/ad-spaces/:id', authenticateToken, adSpaceController.getAdSpace);

// ============================================
// ROTAS AUTENTICADAS - USUÁRIO (Interações)
// ============================================

// Seguir/Deixar de seguir empresa
router.post('/businesses/:id/follow', authenticateToken, businessActionLimiter, businessController.followBusiness);
router.delete('/businesses/:id/follow', authenticateToken, businessController.unfollowBusiness);

// Interações com posts
router.post('/posts/:id/like', authenticateToken, businessActionLimiter, businessPostController.toggleLike);
router.post('/posts/:id/save', authenticateToken, businessActionLimiter, businessPostController.toggleSave);
router.post('/posts/:id/share', authenticateToken, businessPostController.sharePost);
router.post('/posts/:id/comments', authenticateToken, businessActionLimiter, businessPostController.addComment);
router.get('/posts/:id/comments', authenticateToken, businessPostController.getComments);
router.delete('/posts/comments/:commentId', authenticateToken, businessPostController.deleteComment);

// Interações com stories
router.post('/stories/:id/view', authenticateToken, businessStoryController.viewStory);
router.post('/stories/:id/click', authenticateToken, businessStoryController.clickStory);

// Notificações de negócios
router.get('/notifications', authenticateToken, businessNotificationController.getNotifications);
router.get('/notifications/unread-count', authenticateToken, businessNotificationController.getUnreadCount);
router.post('/notifications/:id/read', authenticateToken, businessNotificationController.markAsRead);
router.post('/notifications/read-all', authenticateToken, businessNotificationController.markAllAsRead);


// Solicitação de verificação pelo responsável da empresa.
router.post('/:id/verify', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, status FROM businesses WHERE id = ? AND owner_user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Empresa não encontrada para esta conta.' });
        if (rows[0].status === 'approved') {
            return res.status(409).json({ error: 'Esta empresa já foi verificada.' });
        }
        if (rows[0].status === 'suspended') {
            return res.status(403).json({ error: 'A empresa está suspensa e não pode solicitar verificação.' });
        }

        await db.query(
            "UPDATE businesses SET status = 'pending', approved_at = NULL, approved_by = NULL, rejection_reason = NULL, updated_at = NOW() WHERE id = ? AND owner_user_id = ?",
            [req.params.id, req.user.id]
        );
        return res.json({ message: 'Solicitação de verificação enviada para análise.', status: 'pending' });
    } catch (error) {
        console.error('Erro ao solicitar verificação da empresa:', error);
        return res.status(500).json({ error: 'Não foi possível solicitar a verificação.' });
    }
});

// Analytics and billing use only persisted business and advertising records.
router.get('/analytics', authenticateToken, getBusinessAnalytics);
router.get('/billing', authenticateToken, getBusinessBilling);
router.get('/billing/:id/download', authenticateToken, downloadBusinessInvoice);

// Compatibility aliases used by the centralized frontend API service.
router.get('/dashboard', authenticateToken, businessController.getMyBusiness);
router.get('/dashboard/posts', authenticateToken, businessPostController.getMyPosts);
router.get('/dashboard/campaigns', authenticateToken, businessCampaignController.getMyCampaigns);
router.get('/dashboard/analytics', authenticateToken, getBusinessAnalytics);
router.get('/dashboard/billing', authenticateToken, getBusinessBilling);
router.get('/dashboard/settings', authenticateToken, businessController.getMyBusiness);
router.put('/dashboard/settings', authenticateToken, businessController.updateBusiness);

// ============================================
// ROTAS DA EMPRESA (PAINEL DO ANUNCIANTE)
// ============================================

// Minha empresa
router.get('/my-business', authenticateToken, businessController.getMyBusiness);
router.post('/my-business', authenticateToken, businessCreateLimiter, businessController.createBusiness);
router.put('/my-business', authenticateToken, businessController.updateBusiness);

// Meus posts
router.get('/my-posts', authenticateToken, businessPostController.getMyPosts);
router.post('/my-posts', authenticateToken, businessCreateLimiter, businessPostController.createPost);
router.put('/my-posts/:id', authenticateToken, businessPostController.updatePost);
router.delete('/my-posts/:id', authenticateToken, businessPostController.deletePost);
router.get('/my-posts/:id/stats', authenticateToken, businessPostController.getPostStats);

// Meus stories
router.get('/my-stories', authenticateToken, businessStoryController.getMyStories);
router.post('/my-stories', authenticateToken, businessCreateLimiter, businessStoryController.create);
router.delete('/my-stories/:id', authenticateToken, businessStoryController.delete);
router.get('/my-stories/:id/stats', authenticateToken, businessStoryController.getStoryStats);

// Seguidores da minha empresa
router.get('/my-business/followers', authenticateToken, businessController.getBusinessFollowers);

// Minhas campanhas
router.get('/my-campaigns', authenticateToken, businessCampaignController.getMyCampaigns);
router.post('/my-campaigns', authenticateToken, businessCreateLimiter, businessCampaignController.createCampaign);
router.get('/my-campaigns/:id', authenticateToken, businessCampaignController.getCampaign);
router.put('/my-campaigns/:id', authenticateToken, businessCampaignController.updateCampaign);
router.post('/my-campaigns/:id/submit', authenticateToken, businessCampaignController.submitForApproval);
router.post('/my-campaigns/:id/pause', authenticateToken, businessCampaignController.togglePause);
router.delete('/my-campaigns/:id', authenticateToken, businessCampaignController.deleteCampaign);
router.get('/my-campaigns/:id/stats', authenticateToken, businessCampaignController.getCampaignStats);

// ============================================
// ROTAS ADMINISTRATIVAS
// ============================================

// Middleware admin para todas as rotas abaixo
router.use('/admin', requireAdmin);

// --- EMPRESAS ---
router.get('/admin/businesses', businessController.adminListBusinesses);
router.get('/admin/businesses/stats', businessController.adminGetBusinessStats);
router.post('/admin/businesses/:id/approve', businessController.adminApproveBusiness);
router.post('/admin/businesses/:id/reject', businessController.adminRejectBusiness);
router.post('/admin/businesses/:id/suspend', businessController.adminSuspendBusiness);

// --- POSTS (moderação) ---
// TODO: Adicionar rotas de moderação de posts se necessário

// --- STORIES (moderação) ---
// TODO: Adicionar rotas de moderação de stories se necessário

// --- CAMPANHAS ---
router.get('/admin/campaigns', businessCampaignController.adminListCampaigns);
router.get('/admin/campaigns/stats', businessCampaignController.adminGetCampaignStats);
router.post('/admin/campaigns/:id/approve', businessCampaignController.adminApproveCampaign);
router.post('/admin/campaigns/:id/reject', businessCampaignController.adminRejectCampaign);
router.post('/admin/campaigns/:id/pause', businessCampaignController.adminPauseCampaign);

// --- ESPAÇOS PUBLICITÁRIOS ---
router.get('/admin/ad-spaces', adSpaceController.adminListAdSpaces);
router.post('/admin/ad-spaces', adSpaceController.adminCreateAdSpace);
router.get('/admin/ad-spaces/:id', adSpaceController.getAdSpace);
router.get('/admin/ad-spaces/:id/stats', adSpaceController.adminGetAdSpaceStats);
router.put('/admin/ad-spaces/:id', adSpaceController.adminUpdateAdSpace);
router.delete('/admin/ad-spaces/:id', adSpaceController.adminDeleteAdSpace);

// --- DENÚNCIAS ---
// TODO: Adicionar rotas para business_reports

// Keep the generic company profile route last: otherwise it captures /my-business.
router.get('/:id', authenticateToken, businessController.getBusiness);

module.exports = router;