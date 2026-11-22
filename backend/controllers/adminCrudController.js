const db = require('../db');
const socketHelper = require('../socketHelper');
const { logAdminAction } = require('./adminAuthController');
const { normalizePublicationStatus } = require('../utils/contentVisibility');

// ─── EVENTS ───────────────────────────────────────────────────────────────────

const listEvents = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            const statusValues = {
                ativo: ['ativo', 'active'],
                rascunho: ['rascunho', 'draft'],
                arquivado: ['arquivado', 'archived']
            }[String(status).toLowerCase()] || [status];
            whereClause += ` AND LOWER(e.status) IN (${statusValues.map(() => '?').join(',')})`;
            params.push(...statusValues);
        }

        const query = `
            SELECT e.*, u.name as author_name FROM events e
            JOIN users u ON u.id = e.author_id
            ${whereClause}
            ORDER BY e.created_at DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), offset);
        const [events] = await db.query(query, params);

        const countQuery = `
            SELECT COUNT(*) as total FROM events e
            JOIN users u ON u.id = e.author_id
            ${whereClause}
        `;
        const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

        res.json({ events, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { res.status(500).json({ error: 'Erro ao listar eventos' }); }
};

const getEvent = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT e.*, u.name as author_name
            FROM events e
            LEFT JOIN users u ON u.id = e.author_id
            WHERE e.id = ?
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Evento não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao buscar evento para edição:', err);
        res.status(500).json({ error: 'Erro ao buscar evento.' });
    }
};

const createEvent = async (req, res) => {
    try {
        const admin = req.admin;
        const { title, description, event_date, event_time, location, unit, category, vacancies, image_url, status } = req.body;
        if (!title || !event_date) return res.status(400).json({ error: 'Título e data são obrigatórios.' });
        let publicationStatus;
        try { publicationStatus = normalizePublicationStatus(status, 'ativo'); }
        catch { return res.status(400).json({ error: 'Status de publicação inválido.' }); }

        const [result] = await db.query(
            `INSERT INTO events (author_id, title, description, event_date, event_time, location, unit, category, vacancies, image_url, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [admin.id, title.trim(), description || '', event_date, event_time || null, location || '', unit || '', category || '', Math.max(0, Number(vacancies) || 0), image_url || null, publicationStatus]
        );
        const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
        const ev = rows[0];

        // Broadcast em tempo real para todos os usuários conectados
        socketHelper.broadcast('admin_content_changed', { resource: 'events', id: Number(ev.id) });

        await logAdminAction(admin.id, 'EVENT_CREATED', 'event', ev.id, `Criou o evento "${ev.title}"`, null, req);
        res.status(201).json(ev);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar evento' }); }
};

const updateEvent = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const { title, description, event_date, event_time, location, unit, category, vacancies, image_url, status } = req.body;
        if (!title || !event_date) return res.status(400).json({ error: 'Título e data são obrigatórios.' });
        let publicationStatus;
        try { publicationStatus = normalizePublicationStatus(status, 'ativo'); }
        catch { return res.status(400).json({ error: 'Status de publicação inválido.' }); }

        const [existing] = await db.query('SELECT id FROM events WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ error: 'Evento não encontrado.' });

        await db.query(
            `UPDATE events SET title=?, description=?, event_date=?, event_time=?, location=?, unit=?, category=?, vacancies=?, image_url=?, status=?, updated_at=NOW() WHERE id=?`,
            [title.trim(), description || '', event_date, event_time || null, location || '', unit || '', category || '', Math.max(0, Number(vacancies) || 0), image_url || null, publicationStatus, id]
        );
        const [rows] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
        socketHelper.broadcast('admin_content_changed', { resource: 'events', id: Number(id) });
        await logAdminAction(admin.id, 'EVENT_UPDATED', 'event', parseInt(id), `Editou o evento "${rows[0].title}"`, null, req);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar evento' }); }
};

const deleteEvent = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const [rows] = await db.query('SELECT title FROM events WHERE id = ?', [id]);
        await db.query('DELETE FROM events WHERE id = ?', [id]);
        socketHelper.broadcast('admin_content_changed', { resource: 'events', id: Number(id) });
        await logAdminAction(admin.id, 'EVENT_DELETED', 'event', parseInt(id), `Apagou o evento "${rows[0]?.title}"`, null, req);
        res.json({ message: 'Evento apagado' });
    } catch (err) { res.status(500).json({ error: 'Erro ao apagar evento' }); }
};

// ─── NOTICES ──────────────────────────────────────────────────────────────────

const listNotices = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT n.*, u.name as author_name FROM notices n
            JOIN users u ON u.id = n.author_id
            ORDER BY n.created_at DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar avisos' }); }
};

const createNotice = async (req, res) => {
    try {
        const admin = req.admin;
        const { title, content, unit, priority, image_url, expires_at } = req.body;
        if (!title) return res.status(400).json({ error: 'Título é obrigatório.' });

        const [result] = await db.query(
            `INSERT INTO notices (author_id, title, content, unit, priority, image_url, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [admin.id, title, content || '', unit || '', priority || 'normal', image_url || null, expires_at || null]
        );
        const [rows] = await db.query('SELECT * FROM notices WHERE id = ?', [result.insertId]);
        socketHelper.broadcast('new_notice', rows[0]);
        await logAdminAction(admin.id, 'NOTICE_CREATED', 'notice', rows[0].id, `Criou o aviso "${rows[0].title}"`, null, req);
        res.status(201).json(rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar aviso' }); }
};

const updateNotice = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const { title, content, unit, priority, image_url, expires_at } = req.body;
        await db.query(
            `UPDATE notices SET title=?, content=?, unit=?, priority=?, image_url=?, expires_at=? WHERE id=?`,
            [title, content, unit, priority, image_url, expires_at, id]
        );
        const [rows] = await db.query('SELECT * FROM notices WHERE id = ?', [id]);
        socketHelper.broadcast('notice_updated', rows[0]);
        await logAdminAction(admin.id, 'NOTICE_UPDATED', 'notice', parseInt(id), `Editou o aviso "${rows[0].title}"`, null, req);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar aviso' }); }
};

const deleteNotice = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const [rows] = await db.query('SELECT title FROM notices WHERE id = ?', [id]);
        await db.query('DELETE FROM notices WHERE id = ?', [id]);
        socketHelper.broadcast('notice_deleted', { id: parseInt(id) });
        await logAdminAction(admin.id, 'NOTICE_DELETED', 'notice', parseInt(id), `Apagou o aviso "${rows[0]?.title}"`, null, req);
        res.json({ message: 'Aviso apagado' });
    } catch (err) { res.status(500).json({ error: 'Erro ao apagar aviso' }); }
};

// ─── COURSES ──────────────────────────────────────────────────────────────────

const listCourses = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (c.title LIKE ? OR c.description LIKE ? OR c.area LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            const statusValues = {
                ativo: ['ativo', 'active'],
                rascunho: ['rascunho', 'draft'],
                arquivado: ['arquivado', 'archived']
            }[String(status).toLowerCase()] || [status];
            whereClause += ` AND LOWER(c.status) IN (${statusValues.map(() => '?').join(',')})`;
            params.push(...statusValues);
        }

        const query = `
            SELECT c.*, u.name as author_name FROM courses c
            JOIN users u ON u.id = c.author_id
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), offset);
        const [courses] = await db.query(query, params);

        const countQuery = `
            SELECT COUNT(*) as total FROM courses c
            JOIN users u ON u.id = c.author_id
            ${whereClause}
        `;
        const [[{ total }]] = await db.query(countQuery, params.slice(0, -2));

        res.json({ courses, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { res.status(500).json({ error: 'Erro ao listar cursos' }); }
};

const getCourse = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, u.name as author_name
            FROM courses c
            LEFT JOIN users u ON u.id = c.author_id
            WHERE c.id = ?
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Curso não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Erro ao buscar curso para edição:', err);
        res.status(500).json({ error: 'Erro ao buscar curso.' });
    }
};

const createCourse = async (req, res) => {
    try {
        const admin = req.admin;
        const { title, description, unit, area, duration, modality, period, skills, vacancies, enrollment_info, status, image_url } = req.body;
        if (!title) return res.status(400).json({ error: 'Título é obrigatório.' });
        let publicationStatus;
        try { publicationStatus = normalizePublicationStatus(status, 'ativo'); }
        catch { return res.status(400).json({ error: 'Status de publicação inválido.' }); }

        const [result] = await db.query(
            `INSERT INTO courses (author_id, title, description, unit, area, duration, modality, period, skills, vacancies, enrollment_info, status, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [admin.id, title.trim(), description || '', unit || '', area || '', duration || '', modality || 'Presencial', period || '', skills || '', Math.max(0, Number(vacancies) || 0), enrollment_info || '', publicationStatus, image_url || null]
        );
        const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [result.insertId]);
        socketHelper.broadcast('admin_content_changed', { resource: 'courses', id: Number(rows[0].id) });
        await logAdminAction(admin.id, 'COURSE_CREATED', 'course', rows[0].id, `Criou o curso "${rows[0].title}"`, null, req);
        res.status(201).json(rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar curso' }); }
};

const updateCourse = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const { title, description, unit, area, duration, modality, period, skills, vacancies, enrollment_info, status, image_url } = req.body;
        if (!title) return res.status(400).json({ error: 'Título é obrigatório.' });
        let publicationStatus;
        try { publicationStatus = normalizePublicationStatus(status, 'ativo'); }
        catch { return res.status(400).json({ error: 'Status de publicação inválido.' }); }

        const [existing] = await db.query('SELECT id FROM courses WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ error: 'Curso não encontrado.' });

        await db.query(
            `UPDATE courses SET title=?, description=?, unit=?, area=?, duration=?, modality=?, period=?, skills=?, vacancies=?, enrollment_info=?, status=?, image_url=?, updated_at=NOW() WHERE id=?`,
            [title.trim(), description || '', unit || '', area || '', duration || '', modality || 'Presencial', period || '', skills || '', Math.max(0, Number(vacancies) || 0), enrollment_info || '', publicationStatus, image_url || null, id]
        );
        const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [id]);
        socketHelper.broadcast('admin_content_changed', { resource: 'courses', id: Number(id) });
        await logAdminAction(admin.id, 'COURSE_UPDATED', 'course', parseInt(id), `Editou o curso "${rows[0].title}"`, null, req);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar curso' }); }
};

const deleteCourse = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const [rows] = await db.query('SELECT title FROM courses WHERE id = ?', [id]);
        await db.query('DELETE FROM courses WHERE id = ?', [id]);
        socketHelper.broadcast('admin_content_changed', { resource: 'courses', id: Number(id) });
        await logAdminAction(admin.id, 'COURSE_DELETED', 'course', parseInt(id), `Apagou o curso "${rows[0]?.title}"`, null, req);
        res.json({ message: 'Curso apagado' });
    } catch (err) { res.status(500).json({ error: 'Erro ao apagar curso' }); }
};

// ─── USERS ────────────────────────────────────────────────────────────────────

const listUsers = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let query = 'SELECT id, name, email, role, avatar, unit, area, course, created_at, is_private, is_blocked, admin_role FROM users';
        let params = [];
        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        const [rows] = await db.query(query, params);

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM users${search ? ' WHERE name LIKE ? OR email LIKE ?' : ''}`,
            search ? [`%${search}%`, `%${search}%`] : []
        );
        res.json({ users: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) { res.status(500).json({ error: 'Erro ao listar usuários' }); }
};

const blockUser = async (req, res) => {
    try {
        const admin = req.admin;
        const { id } = req.params;
        const [rows] = await db.query('SELECT is_blocked, name FROM users WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
        const next = rows[0].is_blocked ? 0 : 1;
        await db.query('UPDATE users SET is_blocked = ? WHERE id = ?', [next, id]);
        await logAdminAction(
            admin.id,
            next ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
            'user',
            parseInt(id),
            `${next ? 'Bloqueou' : 'Desbloqueou'} o usuário ${rows[0].name}`,
            null,
            req
        );
        res.json({ message: next ? 'Usuário bloqueado. O login será recusado.' : 'Usuário desbloqueado.', is_blocked: !!next });
    } catch (err) { res.status(500).json({ error: 'Erro ao bloquear usuário' }); }
};

module.exports = {
    listEvents, getEvent, createEvent, updateEvent, deleteEvent,
    listNotices, createNotice, updateNotice, deleteNotice,
    listCourses, getCourse, createCourse, updateCourse, deleteCourse,
    listUsers, blockUser
};
