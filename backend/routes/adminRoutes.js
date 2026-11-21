const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const adminAuthController = require('../controllers/adminAuthController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminNoticesController = require('../controllers/adminNoticesController');
const adminReportsController = require('../controllers/adminReportsController');
const adminUsersController = require('../controllers/adminUsersController');
const adminAuditController = require('../controllers/adminAuditController');
const adminSettingsController = require('../controllers/adminSettingsController');
const adminCrudController = require('../controllers/adminCrudController');
const { requireAdmin, requireRole } = require('../middlewares/adminAuth');
const rateLimiter = require('../utils/rateLimiter');

// Rate limiter para login admin (chave email+IP)
const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const email = (req.body && req.body.email) ? req.body.email.toLowerCase() : 'unknown';
        return `${ip}:${email}`;
    }
});

// ============================================
// ROTAS PÚBLICAS (Login) - Usa login unificado
// ============================================
router.post('/login', loginLimiter, authController.login);

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO ADMIN
// ============================================
router.use(requireAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get('/dashboard', adminDashboardController.getStats);
router.get('/dashboard/charts', adminDashboardController.getCharts);
router.get('/dashboard/activity', adminDashboardController.getActivity);

// ============================================
// AVISOS (NOTICES)
// ============================================
router.get('/notices', adminNoticesController.listNotices);
router.get('/notices/stats', adminNoticesController.getStats);
router.get('/notices/:id', adminNoticesController.getNotice);
router.post('/notices', adminNoticesController.createNotice);
router.put('/notices/:id', adminNoticesController.updateNotice);
router.delete('/notices/:id', adminNoticesController.deleteNotice);
router.patch('/notices/:id/publish', adminNoticesController.togglePublish);
router.patch('/notices/:id/pin', adminNoticesController.togglePin);

// ============================================
// DENÚNCIAS (REPORTS)
// ============================================
router.get('/reports', adminReportsController.listReports);
router.get('/reports/stats', adminReportsController.getStats);
router.get('/reports/:id', adminReportsController.getReport);
router.patch('/reports/:id/review', adminReportsController.startReview);
router.patch('/reports/:id/resolve', adminReportsController.resolveReport);
router.patch('/reports/:id/dismiss', adminReportsController.dismissReport);

// ============================================
// USUÁRIOS
// ============================================
router.get('/users', adminUsersController.listUsers);
router.get('/users/stats', adminUsersController.getStats);
router.get('/users/:id', adminUsersController.getUser);
router.get('/users/:id/activity', adminUsersController.getActivity);
router.patch('/users/:id/block', adminUsersController.toggleBlock);
router.patch('/users/:id/role', requireRole(['super_admin']), adminUsersController.updateRole);
router.patch('/users/:id/profile', adminUsersController.updateProfile);
router.post('/users/:id/reset-password', adminUsersController.resetPassword);

// ============================================
// AUDITORIA
// ============================================
router.get('/audit', adminAuditController.listLogs);
router.get('/audit/stats', adminAuditController.getStats);
router.get('/audit/actions', adminAuditController.getActions);
router.get('/audit/:id', adminAuditController.getLog);
router.get('/audit/export', adminAuditController.exportLogs);

// ============================================
// EVENTOS
// ============================================
router.get('/events', adminCrudController.listEvents);
router.post('/events', adminCrudController.createEvent);
router.put('/events/:id', adminCrudController.updateEvent);
router.delete('/events/:id', adminCrudController.deleteEvent);

// ============================================
// CURSOS
// ============================================
router.get('/courses', adminCrudController.listCourses);
router.post('/courses', adminCrudController.createCourse);
router.put('/courses/:id', adminCrudController.updateCourse);
router.delete('/courses/:id', adminCrudController.deleteCourse);

// ============================================
// CONFIGURAÇÕES
// ============================================
router.get('/settings', adminSettingsController.getSettings);
router.put('/settings', adminSettingsController.updateSettings);
router.post('/settings/reset', adminSettingsController.resetSettings);
router.post('/settings/clear-cache', adminSettingsController.clearCache);
router.get('/settings/export-audit', adminSettingsController.exportAudit);
router.get('/settings/system-info', adminSettingsController.getSystemInfo);

module.exports = router;