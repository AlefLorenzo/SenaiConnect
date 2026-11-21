const express = require('express');
const router = express.Router();
const highlightController = require('../controllers/highlightController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// Get highlights for a user
router.get('/user/:userId/highlights', highlightController.getUserHighlights);

// Create a new highlight
router.post('/user/:userId/highlights', highlightController.createHighlight);

// Update a highlight
router.put('/highlights/:id', highlightController.updateHighlight);

// Delete a highlight
router.delete('/highlights/:id', highlightController.deleteHighlight);

// Add stories to a highlight
router.post('/highlights/:id/stories', highlightController.addStoriesToHighlight);

// Remove story from highlight
router.delete('/highlights/:id/stories/:storyId', highlightController.removeStoryFromHighlight);

module.exports = router;