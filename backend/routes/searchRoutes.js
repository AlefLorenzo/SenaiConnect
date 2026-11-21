const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const searchController = require('../controllers/searchController');

router.get('/', authenticateToken, searchController.search);
router.get('/suggestions', authenticateToken, searchController.getSuggestions);
router.get('/panel', authenticateToken, searchController.getPanelData);

module.exports = router;
