const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/recommendations', authenticateToken, matchController.getRecommendations);

module.exports = router;
