const db = require('../db');
const notificationController = require('./notificationController');

const moderationController = {
  report: async (req, res) => {
    try {
      const reporterId = req.user.id;
      const { target_type, target_id, reason, description } = req.body;
      const allowed = ['post', 'comment', 'user', 'message'];
      if (!allowed.includes(target_type) || !target_id || !reason) {
        return res.status(400).json({ error: 'Tipo, alvo e motivo são obrigatórios.' });
      }
      await db.query(
        'INSERT INTO reports (reporter_id, target_type, target_id, reason, description) VALUES (?, ?, ?, ?, ?)',
        [reporterId, target_type === 'message' ? 'user' : target_type, target_id, reason, description || '']
      );
      res.status(201).json({ message: 'Denúncia enviada. A moderação irá analisar.' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao enviar denúncia.' });
    }
  },

  blockUser: async (req, res) => {
    try {
      const blockerId = req.user.id;
      const targetId = parseInt(req.params.id, 10);
      if (blockerId === targetId) return res.status(400).json({ error: 'Você não pode bloquear a si mesmo.' });
      await db.query(
        'INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)',
        [blockerId, targetId]
      );
      await db.query('DELETE FROM follows WHERE (follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?)',
        [blockerId, targetId, targetId, blockerId]);
      res.status(200).json({ message: 'Usuário bloqueado.', blocked: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao bloquear.' });
    }
  },

  unblockUser: async (req, res) => {
    try {
      await db.query('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, req.params.id]);
      res.status(200).json({ message: 'Bloqueio removido.', blocked: false });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao desbloquear.' });
    }
  },

  listBlocked: async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT u.id, u.name, u.avatar, u.role, b.created_at as blocked_at
         FROM blocks b JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = ? ORDER BY b.created_at DESC`,
        [req.user.id]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao listar bloqueados.' });
    }
  },

  muteUser: async (req, res) => {
    try {
      const muterId = req.user.id;
      const targetId = parseInt(req.params.id, 10);
      if (muterId === targetId) return res.status(400).json({ error: 'Ação inválida.' });
      await db.query('INSERT IGNORE INTO mutes (muter_id, muted_id) VALUES (?, ?)', [muterId, targetId]);
      res.json({ message: 'Usuário silenciado.', muted: true });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao silenciar.' });
    }
  },

  unmuteUser: async (req, res) => {
    try {
      await db.query('DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?', [req.user.id, req.params.id]);
      res.json({ message: 'Silêncio removido.', muted: false });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao dessilenciar.' });
    }
  },

  muteStatus: async (req, res) => {
    try {
      const [rows] = await db.query(
        'SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ?',
        [req.user.id, req.params.id]
      );
      const [blocked] = await db.query(
        'SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
        [req.user.id, req.params.id]
      );
      res.json({ muted: rows.length > 0, blocked: blocked.length > 0 });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao consultar status.' });
    }
  },

  listReports: async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT r.*, u.name as reporter_name, u.email as reporter_email
         FROM reports r JOIN users u ON u.id = r.reporter_id
         ORDER BY r.created_at DESC LIMIT 200`
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Erro ao listar denúncias.' });
    }
  },

  reviewReport: async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ['pending', 'reviewed', 'dismissed'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
      await db.query('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ message: 'Denúncia atualizada.' });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao atualizar denúncia.' });
    }
  },

  notifyIfAllowed: async (userId, type, sourceUserId, postId, content) => {
    const [prefsRows] = await db.query('SELECT notification_prefs FROM users WHERE id = ?', [userId]);
    let prefs = {};
    try {
      prefs = prefsRows[0]?.notification_prefs ? JSON.parse(prefsRows[0].notification_prefs) : {};
    } catch { prefs = {}; }
    const map = { like: 'newLike', comment: 'newComment', follow: 'newPost', message: 'messages' };
    const key = map[type];
    if (key && prefs[key] === false) return;
    const [muted] = await db.query('SELECT 1 FROM mutes WHERE muter_id = ? AND muted_id = ?', [userId, sourceUserId]);
    if (muted.length) return;
    await notificationController.createNotification(userId, type, sourceUserId, postId, content);
  },
};

module.exports = moderationController;
