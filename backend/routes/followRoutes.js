const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const followController = require('../controllers/followController');

router.post('/:id', authenticateToken, followController.followUser);
router.delete('/:id', authenticateToken, followController.unfollowUser);
router.get('/:id/stats', authenticateToken, followController.getStats);
router.get('/:id/status', authenticateToken, followController.checkFollowStatus);

module.exports = router;
