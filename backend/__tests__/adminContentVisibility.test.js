'use strict';

const mockDb = { query: jest.fn() };

jest.mock('../db', () => mockDb);
jest.mock('../socketHelper', () => ({ broadcast: jest.fn() }));
jest.mock('../controllers/adminAuthController', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../controllers/notificationController', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined)
}));

const socketHelper = require('../socketHelper');
const adminCrudController = require('../controllers/adminCrudController');
const adminNoticesController = require('../controllers/adminNoticesController');
const publicRoutes = require('../routes/publicRoutes');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
});

const getPublicHandler = (path) => {
  const layer = publicRoutes.stack.find(item => item.route?.path === path);
  if (!layer) throw new Error('Rota pública não encontrada: ' + path);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('admin-created content delivery', () => {
  beforeEach(() => jest.clearAllMocks());

  test('event creation emits only a safe refresh signal, not the event record', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ insertId: 51 }])
      .mockResolvedValueOnce([[{ id: 51, title: 'Semana de Tecnologia', status: 'ativo' }]]);

    const req = {
      admin: { id: 9 },
      body: { title: 'Semana de Tecnologia', event_date: '2026-12-01T12:00:00.000Z', status: 'ativo' }
    };
    const res = createResponse();

    await adminCrudController.createEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(socketHelper.broadcast).toHaveBeenCalledWith('admin_content_changed', { resource: 'events' });
    expect(socketHelper.broadcast.mock.calls[0][1]).not.toHaveProperty('title');
  });

  test('course creation emits a safe refresh signal for the student course catalogue', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ insertId: 62 }])
      .mockResolvedValueOnce([[{ id: 62, title: 'Desenvolvimento Web', status: 'ativo' }]]);

    const req = {
      admin: { id: 9 },
      body: { title: 'Desenvolvimento Web', status: 'ativo', unit: '' }
    };
    const res = createResponse();

    await adminCrudController.createCourse(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(socketHelper.broadcast).toHaveBeenCalledWith('admin_content_changed', { resource: 'courses' });
    expect(socketHelper.broadcast.mock.calls[0][1]).not.toHaveProperty('title');
  });

  test('notice creation emits a safe refresh signal without disclosing its audience or text', async () => {
    mockDb.query
      .mockResolvedValueOnce([{ insertId: 73 }])
      .mockResolvedValueOnce([[
        { id: 73, title: 'Comunicado reservado', content: 'Texto interno', recipients: '{"type":"units","values":["SENAI Alagoinhas"]}', status: 'published' }
      ]]);

    const req = {
      admin: { id: 9 },
      body: {
        title: 'Comunicado reservado',
        content: 'Texto interno',
        recipients: JSON.stringify({ type: 'units', values: ['SENAI Alagoinhas'] }),
        status: 'published',
        published_at: null,
        send_notification: false
      }
    };
    const res = createResponse();

    await adminNoticesController.createNotice(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(socketHelper.broadcast).toHaveBeenCalledWith('admin_content_changed', { resource: 'notices' });
    expect(socketHelper.broadcast.mock.calls[0][1]).not.toHaveProperty('title');
    expect(socketHelper.broadcast.mock.calls[0][1]).not.toHaveProperty('recipients');
  });

  test('public event listing applies the authenticated user unit and publication status filters', async () => {
    const eventRow = { id: 51, title: 'Semana de Tecnologia' };
    mockDb.query.mockResolvedValueOnce([[eventRow]]);
    const req = { user: { id: 12, role: 'Aluno', unit: 'SENAI Alagoinhas' }, query: {} };
    const res = createResponse();

    await getPublicHandler('/events')(req, res);

    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain("LOWER(TRIM(COALESCE(e.status, ''))) IN ('ativo', 'active')");
    expect(sql).toContain('LOWER(TRIM(e.unit)) = LOWER(TRIM(?))');
    expect(params).toEqual(['SENAI Alagoinhas']);
    expect(res.json).toHaveBeenCalledWith([eventRow]);
  });

  test('public course listing applies the authenticated user unit and publication status filters', async () => {
    const courseRow = { id: 62, title: 'Desenvolvimento Web' };
    mockDb.query.mockResolvedValueOnce([[courseRow]]);
    const req = { user: { id: 12, role: 'Aluno', unit: 'SENAI Alagoinhas' }, query: {} };
    const res = createResponse();

    await getPublicHandler('/courses')(req, res);

    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain("LOWER(TRIM(COALESCE(c.status, ''))) IN ('ativo', 'active')");
    expect(sql).toContain('LOWER(TRIM(c.unit)) = LOWER(TRIM(?))');
    expect(params).toEqual(['SENAI Alagoinhas']);
    expect(res.json).toHaveBeenCalledWith([courseRow]);
  });
});
