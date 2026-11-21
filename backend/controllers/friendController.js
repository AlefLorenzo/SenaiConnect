const db = require('../db');
const socketHelper = require('../socketHelper');
const notificationController = require('./notificationController');

// Helper: verifica se dois usuários são amigos confirmados
async function areFriends(userA, userB) {
  const [rows] = await db.query(
    `SELECT id FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
    [userA, userB, userB, userA]
  );
  return rows.length > 0;
}

const friendController = {
  // Envia solicitação de amizade
  sendRequest: async (req, res) => {
    try {
      const requesterId = req.user.id;
      const { targetId } = req.params;

      if (parseInt(targetId) === requesterId) {
        return res.status(400).json({ error: 'Você não pode adicionar a si mesmo.' });
      }

      // Verifica se o target existe
      const [target] = await db.query('SELECT id FROM users WHERE id = ?', [targetId]);
      if (target.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

      // Verifica se já existe solicitação em qualquer direção
      const [existing] = await db.query(
        `SELECT id, status, requester_id FROM friendships
         WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
        [requesterId, targetId, targetId, requesterId]
      );

      if (existing.length > 0) {
        const f = existing[0];
        if (f.status === 'accepted') return res.status(400).json({ error: 'Vocês já são amigos.' });
        if (f.status === 'pending') {
          if (f.requester_id === requesterId) {
            return res.status(400).json({ error: 'Solicitação já enviada.' });
          }
          // O outro havia enviado — aceita automaticamente
          await db.query(
            `UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
            [f.id]
          );
          // Notifica ambos
          await notificationController.createNotification(
            parseInt(targetId),
            'friend_accepted',
            requesterId,
            'aceitou sua solicitação de amizade.',
            'friendship',
            f.id,
            null,
            { action: 'friend_accepted', friendship_id: f.id }
          );
          socketHelper.sendToUser(parseInt(targetId), 'friend_accepted', { by_user_id: requesterId });
          return res.status(200).json({ message: 'Amizade confirmada!', status: 'accepted' });
        }
        if (f.status === 'rejected') {
          // Permite reenviar se foi rejeitada
          await db.query(`DELETE FROM friendships WHERE id = ?`, [f.id]);
        }
      }

      await db.query(
        `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`,
        [requesterId, targetId]
      );

      // Notifica o destinatário
      await notificationController.createNotification(
        parseInt(targetId),
        'friend_request',
        requesterId,
        'enviou uma solicitação de amizade.',
        'friendship',
        null,
        null,
        { action: 'friend_request' }
      );
      socketHelper.sendToUser(parseInt(targetId), 'friend_request', { from_user_id: requesterId });

      res.status(201).json({ message: 'Solicitação enviada!', status: 'pending_sent' });
    } catch (e) {
      console.error('sendRequest error:', e);
      res.status(500).json({ error: 'Erro ao enviar solicitação.' });
    }
  },

  // Aceita ou rejeita solicitação
  respondRequest: async (req, res) => {
    try {
      const userId = req.user.id;
      const { requestId } = req.params;
      const { action } = req.body; // 'accept' | 'reject'

      if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Ação inválida. Use 'accept' ou 'reject'." });
      }

      const [rows] = await db.query(
        `SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'`,
        [requestId, userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const friendship = rows[0];
      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      await db.query(
        `UPDATE friendships SET status = ?, updated_at = NOW() WHERE id = ?`,
        [newStatus, requestId]
      );

      if (action === 'accept') {
        await notificationController.createNotification(
          friendship.requester_id,
          'friend_accepted',
          userId,
          'aceitou sua solicitação de amizade.',
          'friendship',
          friendship.id,
          null,
          { action: 'friend_accepted', friendship_id: friendship.id }
        );
        socketHelper.sendToUser(friendship.requester_id, 'friend_accepted', { by_user_id: userId });
      }

      res.status(200).json({ message: action === 'accept' ? 'Amizade confirmada!' : 'Solicitação recusada.', status: newStatus });
    } catch (e) {
      console.error('respondRequest error:', e);
      res.status(500).json({ error: 'Erro ao responder solicitação.' });
    }
  },

  // Lista amigos confirmados do usuário logado
  getFriends: async (req, res) => {
    try {
      const userId = req.user.id;
      const [rows] = await db.query(
        `SELECT u.id, u.name, u.avatar, u.role, u.bio, f.id as friendship_id, f.created_at as friends_since
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
         WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
         ORDER BY u.name ASC`,
        [userId, userId, userId]
      );
      res.status(200).json(rows);
    } catch (e) {
      console.error('getFriends error:', e);
      res.status(500).json({ error: 'Erro ao buscar amigos.' });
    }
  },

  // Solicitações recebidas pendentes
  getPendingRequests: async (req, res) => {
    try {
      const userId = req.user.id;
      const [rows] = await db.query(
        `SELECT f.id as request_id, f.created_at,
                u.id as user_id, u.name, u.avatar, u.role
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
         WHERE f.addressee_id = ? AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );
      res.status(200).json(rows);
    } catch (e) {
      console.error('getPendingRequests error:', e);
      res.status(500).json({ error: 'Erro ao buscar solicitações.' });
    }
  },

  // Solicitações enviadas pendentes
  getSentRequests: async (req, res) => {
    try {
      const userId = req.user.id;
      const [rows] = await db.query(
        `SELECT f.id as request_id, f.created_at,
                u.id as user_id, u.name, u.avatar, u.role
         FROM friendships f
         JOIN users u ON u.id = f.addressee_id
         WHERE f.requester_id = ? AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );
      res.status(200).json(rows);
    } catch (e) {
      console.error('getSentRequests error:', e);
      res.status(500).json({ error: 'Erro ao buscar solicitações enviadas.' });
    }
  },

  // Remove amizade
  removeFriend: async (req, res) => {
    try {
      const userId = req.user.id;
      const { friendId } = req.params;
      await db.query(
        `DELETE FROM friendships
         WHERE status = 'accepted'
           AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`,
        [userId, friendId, friendId, userId]
      );
      res.status(200).json({ message: 'Amizade removida.' });
    } catch (e) {
      console.error('removeFriend error:', e);
      res.status(500).json({ error: 'Erro ao remover amizade.' });
    }
  },

  // Retorna o status de amizade entre o usuário logado e outro usuário
  getFriendshipStatus: async (req, res) => {
    try {
      const userId = req.user.id;
      const { targetId } = req.params;

      if (parseInt(targetId) === userId) {
        return res.status(200).json({ status: 'self' });
      }

      const [rows] = await db.query(
        `SELECT id, status, requester_id, addressee_id FROM friendships
         WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
        [userId, targetId, targetId, userId]
      );

      if (rows.length === 0) return res.status(200).json({ status: 'none' });

      const f = rows[0];
      if (f.status === 'accepted') return res.status(200).json({ status: 'accepted', friendship_id: f.id });
      if (f.status === 'rejected') return res.status(200).json({ status: 'none' });
      if (f.status === 'pending') {
        if (f.requester_id === userId) {
          return res.status(200).json({ status: 'pending_sent', request_id: f.id });
        } else {
          return res.status(200).json({ status: 'pending_received', request_id: f.id });
        }
      }

      res.status(200).json({ status: 'none' });
    } catch (e) {
      console.error('getFriendshipStatus error:', e);
      res.status(500).json({ error: 'Erro ao verificar status de amizade.' });
    }
  }
};

module.exports = { friendController, areFriends };
