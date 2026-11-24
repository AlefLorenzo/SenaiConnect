const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middlewares/auth');
const { buildUnitVisibilityClause } = require('../utils/contentVisibility');

router.get('/events', authenticateToken, async (req, res) => {
    try {
        const visibility = buildUnitVisibilityClause(req.user, 'e');
        const [rows] = await db.query(`
            SELECT e.*, u.name as author_name, u.avatar as author_avatar,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as enrolled_count
            FROM events e
            LEFT JOIN users u ON u.id = e.author_id
            WHERE LOWER(TRIM(COALESCE(e.status, ''))) IN ('ativo', 'active')
              AND ${visibility.sql}
            ORDER BY e.event_date ASC, e.created_at DESC
        `, visibility.params);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar eventos publicados:', err);
        res.status(500).json({ error: 'Não foi possível carregar os eventos.' });
    }
});

router.get('/courses', authenticateToken, async (req, res) => {
    try {
        const visibility = buildUnitVisibilityClause(req.user, 'c');
        const [rows] = await db.query(`
            SELECT c.*, u.name as author_name, u.avatar as author_avatar,
              (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) as enrolled_count
            FROM courses c
            LEFT JOIN users u ON u.id = c.author_id
            WHERE LOWER(TRIM(COALESCE(c.status, ''))) IN ('ativo', 'active')
              AND ${visibility.sql}
            ORDER BY c.created_at DESC
        `, visibility.params);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar cursos publicados:', err);
        res.status(500).json({ error: 'Não foi possível carregar os cursos.' });
    }
});

module.exports = router;
