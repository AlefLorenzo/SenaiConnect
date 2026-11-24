const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middlewares/auth');
const multer = require('multer');

// Multer config for handling multipart/form-data (no file storage needed for text messages)
const upload = multer();

// Unread counters (register before parameterized conversation routes).
router.get('/unread-count', authenticateToken, messageController.getUnreadCount);

// Conversations
router.get('/conversations', authenticateToken, messageController.getConversations);
router.get('/conversations/:id', authenticateToken, messageController.getConversation);
router.get('/conversations/:id/history', authenticateToken, messageController.getHistory);
router.post('/conversations', authenticateToken, messageController.createConversation);

// Messages - use upload.none() to parse multipart/form-data fields without file uploads
router.post('/conversations/:id/messages', authenticateToken, upload.none(), messageController.sendMessage);
router.post('/messages/upload', authenticateToken, upload.single('file'), messageController.uploadMedia);
router.post('/conversations/:id/read', authenticateToken, messageController.markAsRead);

// Typing indicators
router.post('/conversations/:id/typing/start', authenticateToken, messageController.typingStart);
router.post('/conversations/:id/typing/stop', authenticateToken, messageController.typingStop);

// Group mute/important
router.post('/groups/:id/mute', authenticateToken, messageController.toggleGroupMute);
router.post('/groups/:id/important', authenticateToken, messageController.toggleGroupImportant);

// Group management
router.post('/groups/:id/members', authenticateToken, messageController.addGroupMember);
router.delete('/groups/:id/members/:userId', authenticateToken, messageController.removeGroupMember);
router.post('/groups/:id/admins', authenticateToken, messageController.changeGroupAdmin);
router.put('/groups/:id', authenticateToken, messageController.updateGroup);
router.delete('/groups/:id', authenticateToken, messageController.deleteGroup);

module.exports = router;
