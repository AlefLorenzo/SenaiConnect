const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderationController');
const { authenticateToken } = require('../middlewares/auth');

router.post('/reports', authenticateToken, moderationController.report);
router.get('/blocked', authenticateToken, moderationController.listBlocked);
router.get('/users/:id/status', authenticateToken, moderationController.muteStatus);
router.post('/users/:id/block', authenticateToken, moderationController.blockUser);
router.delete('/users/:id/block', authenticateToken, moderationController.unblockUser);
router.post('/users/:id/mute', authenticateToken, moderationController.muteUser);
router.delete('/users/:id/mute', authenticateToken, moderationController.unmuteUser);

module.exports = router;
