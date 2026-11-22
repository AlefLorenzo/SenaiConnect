const mockDb = { query: jest.fn() };

jest.mock('../db', () => mockDb);

const adminDashboardController = require('../controllers/adminDashboardController');

const createResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

describe('Admin dashboard statistics', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns all dashboard counters as numbers using a single database query', async () => {
        const req = {};
        const res = createResponse();

        mockDb.query.mockResolvedValueOnce([{
            totalStudents: '12',
            activeUsers: '8',
            totalNotices: '5',
            pendingReports: '2',
            resolvedReports: '7',
            reviewingReports: '1'
        }]);

        await adminDashboardController.getStats(req, res);

        expect(mockDb.query).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith({
            stats: {
                totalStudents: 12,
                activeUsers: 8,
                totalNotices: 5,
                pendingReports: 2,
                resolvedReports: 7,
                reviewingReports: 1
            }
        });
        expect(res.status).not.toHaveBeenCalled();
    });

    test('uses safe zero defaults when the database returns null counters', async () => {
        const req = {};
        const res = createResponse();

        mockDb.query.mockResolvedValueOnce([{
            totalStudents: null,
            activeUsers: null,
            totalNotices: null,
            pendingReports: null,
            resolvedReports: null,
            reviewingReports: null
        }]);

        await adminDashboardController.getStats(req, res);

        expect(res.json).toHaveBeenCalledWith({
            stats: {
                totalStudents: 0,
                activeUsers: 0,
                totalNotices: 0,
                pendingReports: 0,
                resolvedReports: 0,
                reviewingReports: 0
            }
        });
    });

    test('returns a controlled server error when the statistics query fails', async () => {
        const req = {};
        const res = createResponse();

        mockDb.query.mockRejectedValueOnce(new Error('database unavailable'));

        await adminDashboardController.getStats(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Erro ao buscar estatísticas do dashboard'
        });
    });
});
