const express = require('express');
const router = express.Router();
const engagementController = require('../controllers/engagementController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/posts/:id', authenticateToken, engagementController.getPost);
router.post('/posts/:id/share', authenticateToken, engagementController.share);
router.post('/comments/:id/like', authenticateToken, engagementController.toggleCommentLike);

router.get('/events/mine', authenticateToken, engagementController.myEvents);
router.get('/events/my', authenticateToken, engagementController.myEvents);
router.post('/events/:id/register', authenticateToken, engagementController.toggleEvent);

router.get('/courses/mine', authenticateToken, engagementController.myCourses);
router.get('/courses/my', authenticateToken, engagementController.myCourses);
router.post('/courses/:id/enroll', authenticateToken, engagementController.toggleCourse);

router.post('/notices/read-all', authenticateToken, engagementController.markAllNoticesRead);
router.post('/notices/:id/read', authenticateToken, engagementController.markNoticeRead);

router.get('/me/export', authenticateToken, engagementController.exportMe);
router.post('/me/delete', authenticateToken, engagementController.deleteMe);

module.exports = router;
