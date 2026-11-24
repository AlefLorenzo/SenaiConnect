const db = require('../db');
const { isBlockedEitherWay } = require('../utils/social');

const engagementController = {
  getPost: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [posts] = await db.query(
        `SELECT p.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
          (SELECT COUNT(*) FROM post_shares WHERE post_id = p.id) as shares_count,
          EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as liked,
          EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = ?) as saved
         FROM posts p JOIN users u ON p.user_id = u.id
         WHERE p.id = ? AND p.deleted_at IS NULL`,
        [userId, userId, id]
      );
      if (!posts.length) return res.status(404).json({ error: 'Post não encontrado.' });
      const post = posts[0];
      if (await isBlockedEitherWay(userId, post.user_id)) {
        return res.status(403).json({ error: 'Conteúdo indisponível.' });
      }
      if (post.shared_post_id) {
        const [orig] = await db.query(
          `SELECT p.*, u.name as user_name, u.avatar as user_avatar
           FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.deleted_at IS NULL`,
          [post.shared_post_id]
        );
        post.original_post = orig[0] || null;
      }
      res.json(post);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao buscar post.' });
    }
  },

  share: async (req, res) => {
    try {
      const userId = req.user.id;
      const postId = parseInt(req.params.id, 10);
      const { quote } = req.body || {};
      const [source] = await db.query('SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL', [postId]);
      if (!source.length) return res.status(404).json({ error: 'Post não encontrado.' });
      const originalId = source[0].shared_post_id || source[0].id;
      await db.query('INSERT IGNORE INTO post_shares (post_id, user_id) VALUES (?, ?)', [originalId, userId]);
      const content = (quote && quote.trim()) ? quote.trim() : 'Compartilhou uma publicação';
      const [result] = await db.query(
        'INSERT INTO posts (user_id, content, shared_post_id, category, post_type) VALUES (?, ?, ?, ?, ?)',
        [userId, content, originalId, source[0].category || 'Geral', 'general']
      );
      res.status(201).json({ id: result.insertId, message: 'Publicação compartilhada.' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao compartilhar.' });
    }
  },

  toggleEvent: async (req, res) => {
    const userId = req.user.id;
    const eventId = Number.parseInt(req.params.id, 10);
    const registration = req.body || {};
    const registrationName = String(registration.registration_name || registration.name || '').trim();
    if (!registrationName) return res.status(400).json({ error: 'Informe seu nome para confirmar a inscrição.' });
    if (!Number.isSafeInteger(eventId) || eventId <= 0) return res.status(400).json({ error: 'Evento inválido.' });

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      const [events] = await connection.query(
        "SELECT id, vacancies, status FROM events WHERE id = ? FOR UPDATE", [eventId]
      );
      if (!events.length || !['ativo', 'active'].includes(String(events[0].status || '').toLowerCase())) {
        await connection.rollback();
        return res.status(404).json({ error: 'Evento não encontrado ou não está aceitando inscrições.' });
      }
      const [existing] = await connection.query(
        'SELECT event_id FROM event_registrations WHERE event_id = ? AND user_id = ?', [eventId, userId]
      );
      if (existing.length) {
        await connection.rollback();
        return res.status(409).json({ error: 'Você já está inscrito neste evento.' });
      }
      const [counts] = await connection.query(
        'SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ?', [eventId]
      );
      const total = Number(counts[0]?.count || 0);
      const vacancies = Number(events[0].vacancies || 0);
      if (vacancies > 0 && total >= vacancies) {
        await connection.rollback();
        return res.status(409).json({ error: 'As vagas deste evento já foram preenchidas.' });
      }
      await connection.query(
        `INSERT INTO event_registrations
          (event_id, user_id, registration_name, team_name, participation_type, shift, course, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId, userId, registrationName,
          String(registration.team_name || '').trim() || null,
          registration.participation_type === 'group' ? 'group' : 'individual',
          String(registration.shift || '').trim() || null,
          String(registration.course || '').trim() || null,
          String(registration.notes || '').trim() || null
        ]
      );
      await connection.commit();
      const [updated] = await db.query(
        'SELECT COUNT(*) AS enrolled_count FROM event_registrations WHERE event_id = ?', [eventId]
      );
      const enrolledCount = Number(updated[0]?.enrolled_count || 0);
      const socketHelper = require('../socketHelper');
      socketHelper.broadcast('event_registration_changed', { eventId, enrolledCount });
      res.status(201).json({ registered: true, enrolled_count: enrolledCount, vacancies: Math.max(vacancies - enrolledCount, 0), message: 'Inscrição confirmada com sucesso!' });
    } catch (e) {
      if (connection) await connection.rollback().catch(() => {});
      console.error('Erro ao inscrever no evento:', e);
      res.status(500).json({ error: 'Não foi possível concluir sua inscrição.' });
    } finally {
      if (connection) connection.release();
    }
  },

  myEvents: async (req, res) => {
    try {
      const [rows] = await db.query(
        'SELECT event_id FROM event_registrations WHERE user_id = ?',
        [req.user.id]
      );
      res.json({ ids: rows.map((r) => r.event_id) });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar inscrições.' });
    }
  },

  markNoticeRead: async (req, res) => {
    try {
      await db.query(
        'INSERT IGNORE INTO notice_reads (notice_id, user_id) VALUES (?, ?)',
        [req.params.id, req.user.id]
      );
      res.json({ read: true });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao marcar aviso.' });
    }
  },

  markAllNoticesRead: async (req, res) => {
    try {
      await db.query(
        `INSERT IGNORE INTO notice_reads (notice_id, user_id)
         SELECT id, ? FROM notices`,
        [req.user.id]
      );
      res.json({ read: true });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao marcar avisos.' });
    }
  },

  exportMe: async (req, res) => {
    try {
      const id = req.user.id;
      const [[user]] = await db.query(
        'SELECT id, name, email, role, bio, course, unit, city, skills, objective, created_at FROM users WHERE id = ?',
        [id]
      );
      const [posts] = await db.query('SELECT id, content, created_at FROM posts WHERE user_id = ? AND deleted_at IS NULL', [id]);
      const [comments] = await db.query('SELECT id, post_id, content, created_at FROM comments WHERE user_id = ?', [id]);
      res.json({ exported_at: new Date().toISOString(), user, posts, comments });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao exportar dados.' });
    }
  },

  deleteMe: async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'Informe a senha para confirmar.' });
      const bcrypt = require('bcrypt');
      const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!users.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
      const ok = await bcrypt.compare(password, users[0].password_hash);
      if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });
      await db.query(
        'UPDATE users SET deleted_at = NOW(), email = CONCAT("deleted_", id, "_", email), is_blocked = 1 WHERE id = ?',
        [req.user.id]
      );
      res.json({ message: 'Conta desativada.' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro ao excluir conta.' });
    }
  },

  toggleCourse: async (req, res) => {
    try {
      const userId = req.user.id;
      const courseId = parseInt(req.params.id, 10);
      const [course] = await db.query('SELECT id FROM courses WHERE id = ? AND status = "ativo"', [courseId]);
      if (!course.length) return res.status(404).json({ error: 'Curso não encontrado.' });
      const [existing] = await db.query(
        'SELECT 1 FROM course_enrollments WHERE course_id = ? AND user_id = ?',
        [courseId, userId]
      );
      if (existing.length) {
        await db.query('DELETE FROM course_enrollments WHERE course_id = ? AND user_id = ?', [courseId, userId]);
        return res.json({ enrolled: false, message: 'Matrícula cancelada.' });
      }
      await db.query('INSERT INTO course_enrollments (course_id, user_id) VALUES (?, ?)', [courseId, userId]);
      res.status(201).json({ enrolled: true, message: 'Matrícula confirmada.' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Erro na matrícula.' });
    }
  },

  myCourses: async (req, res) => {
    try {
      const [rows] = await db.query(
        'SELECT course_id, progress FROM course_enrollments WHERE user_id = ?',
        [req.user.id]
      );
      res.json({ ids: rows.map((r) => r.course_id), progress: Object.fromEntries(rows.map((r) => [r.course_id, r.progress])) });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao buscar matrículas.' });
    }
  },

  toggleCommentLike: async (req, res) => {
    try {
      const userId = req.user.id;
      const commentId = req.params.id;
      const [existing] = await db.query(
        'SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, userId]
      );
      if (existing.length) {
        await db.query('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
        return res.json({ liked: false });
      }
      await db.query('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [commentId, userId]);
      res.json({ liked: true });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao curtir comentário.' });
    }
  },
};

module.exports = engagementController;
