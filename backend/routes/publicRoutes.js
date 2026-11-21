const express = require('express');
const router = express.createElement ? express.Router() : express.Router(); // fallback just in case
const db = require('../db');

router.get('/events', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT e.*,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as enrolled_count
            FROM events e
            WHERE e.status = "ativo"
            ORDER BY e.event_date ASC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.get('/courses', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, u.name as author_name, u.avatar as author_avatar,
              (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) as enrolled_count
            FROM courses c
            LEFT JOIN users u ON u.id = c.author_id
            WHERE c.status = "ativo"
            ORDER BY c.created_at DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.get('/notices', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM notices ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

module.exports = router;
