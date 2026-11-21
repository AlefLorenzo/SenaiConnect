const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/settings - Get user settings
router.get('/', settingsController.getSettings);

// PUT /api/settings - Update user settings
router.put('/', settingsController.updateSettings);

// PUT /api/settings/theme - Update theme only
router.put('/theme', settingsController.updateTheme);

module.exports = router;