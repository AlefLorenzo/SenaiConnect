const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticateToken } = require('../middlewares/auth');

// User's groups (my groups)
router.get('/my-groups', authenticateToken, groupController.getMyGroups);

// Group CRUD
router.get('/', authenticateToken, groupController.getAll);
router.post('/', authenticateToken, groupController.create);
router.get('/:id', authenticateToken, groupController.getById);
router.post('/:id/join', authenticateToken, groupController.join);
router.post('/:id/leave', authenticateToken, groupController.leave);
router.get('/:id/members', authenticateToken, groupController.getMembers);
router.post('/:id/members', authenticateToken, groupController.addMembers);
router.delete('/:id/members/:userId', authenticateToken, groupController.removeMember);

// Group settings
router.post('/:id/mute', authenticateToken, groupController.toggleMute);
router.post('/:id/important', authenticateToken, groupController.toggleImportant);

// Group posts
router.get('/:id/posts', authenticateToken, groupController.getPosts);
router.post('/:id/posts', authenticateToken, groupController.createPost);

module.exports = router;
