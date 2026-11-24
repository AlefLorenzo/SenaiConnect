const express = require('express');
const router = express.Router();
const { friendController } = require('../controllers/friendController');
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');

router.post('/request/:targetId', authenticateToken, friendController.sendRequest);
router.post('/:id/request', authenticateToken, (req, res) => {
    req.params.targetId = req.params.id;
    return friendController.sendRequest(req, res);
});
router.put('/respond/:requestId', authenticateToken, friendController.respondRequest);
router.post('/:id/accept', authenticateToken, async (req, res) => {
    try {
        const [requests] = await db.query(
            "SELECT id FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
            [req.params.id, req.user.id]
        );
        if (!requests.length) return res.status(404).json({ error: 'Solicitação pendente não encontrada.' });
        req.params.requestId = requests[0].id;
        req.body = { ...(req.body || {}), action: 'accept' };
        return friendController.respondRequest(req, res);
    } catch (error) {
        console.error('Erro ao localizar solicitação de amizade:', error);
        return res.status(500).json({ error: 'Erro ao aceitar solicitação.' });
    }
});
router.post('/:id/reject', authenticateToken, async (req, res) => {
    try {
        const [requests] = await db.query(
            "SELECT id FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
            [req.params.id, req.user.id]
        );
        if (!requests.length) return res.status(404).json({ error: 'Solicitação pendente não encontrada.' });
        req.params.requestId = requests[0].id;
        req.body = { ...(req.body || {}), action: 'reject' };
        return friendController.respondRequest(req, res);
    } catch (error) {
        console.error('Erro ao localizar solicitação de amizade:', error);
        return res.status(500).json({ error: 'Erro ao rejeitar solicitação.' });
    }
});
router.get('/', authenticateToken, friendController.getFriends);
router.get('/pending', authenticateToken, friendController.getPendingRequests);
router.get('/requests', authenticateToken, friendController.getPendingRequests);
router.get('/sent', authenticateToken, friendController.getSentRequests);
router.delete('/:friendId', authenticateToken, friendController.removeFriend);
router.post('/:id/remove', authenticateToken, (req, res) => {
    req.params.friendId = req.params.id;
    return friendController.removeFriend(req, res);
});
router.get('/:id/status', authenticateToken, (req, res) => {
    req.params.targetId = req.params.id;
    return friendController.getFriendshipStatus(req, res);
});
router.get('/status/:targetId', authenticateToken, friendController.getFriendshipStatus);

module.exports = router;
