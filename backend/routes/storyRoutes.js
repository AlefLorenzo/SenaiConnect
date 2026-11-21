const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { authenticateToken } = require('../middlewares/auth');

// Public/feed routes
router.get('/', authenticateToken, storyController.getAll);
router.post('/', authenticateToken, storyController.create);
router.delete('/:id', authenticateToken, storyController.delete);

// Story interactions
router.post('/:id/view', authenticateToken, storyController.view);
router.get('/:id/viewers', authenticateToken, storyController.getViewers);
router.get('/:id/reactions', authenticateToken, storyController.getReactions);
router.post('/:id/react', authenticateToken, storyController.react);
router.get('/:id/replies', authenticateToken, storyController.getReplies);
router.post('/:id/reply', authenticateToken, storyController.reply);

// Privacy exceptions (owner only)
router.get('/:id/privacy-exceptions', authenticateToken, storyController.getPrivacyExceptions);

// User stories (for profile highlights)
router.get('/user/:userId', authenticateToken, storyController.getUserStories);

module.exports = router;