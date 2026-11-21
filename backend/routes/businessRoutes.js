const express = require('express');
const router = express.Router();
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

// ============================================
// ROTAS PÚBLICAS (Feed, Busca, Perfis)
// ============================================

// Feed de publicações empresariais
router.get('/posts', authenticateToken, businessPostController.listPosts);
router.get('/posts/:id', authenticateToken, businessPostController.getPost);

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

module.exports = router;