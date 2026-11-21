const express = require('express');
const router = express.Router();
const { friendController } = require('../controllers/friendController');
const { authenticateToken } = require('../middlewares/auth');

router.post('/request/:targetId', authenticateToken, friendController.sendRequest);
router.put('/respond/:requestId', authenticateToken, friendController.respondRequest);
router.get('/', authenticateToken, friendController.getFriends);
router.get('/pending', authenticateToken, friendController.getPendingRequests);
router.get('/sent', authenticateToken, friendController.getSentRequests);
router.delete('/:friendId', authenticateToken, friendController.removeFriend);
router.get('/status/:targetId', authenticateToken, friendController.getFriendshipStatus);

module.exports = router;
