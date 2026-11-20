const express = require('express');
const router = express.Router();
const controller = require('../controllers/aiHireController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/interviews', requireAuth, requireRole('ADMIN'), controller.adminList);
router.get('/interviews/:id', requireAuth, requireRole('ADMIN'), controller.adminItem);
router.get('/assignments', requireAuth, requireRole('ADMIN'), controller.adminListAssignments);
router.post('/assignments', requireAuth, requireRole('ADMIN'), controller.adminCreateAssignment);
router.post('/assignments/:id/close', requireAuth, requireRole('ADMIN'), controller.adminCloseAssignment);
router.get('/assignments/:id/email', requireAuth, requireRole('ADMIN'), controller.adminAssignmentEmailStatus);
router.post('/assignments/:id/email', requireAuth, requireRole('ADMIN'), controller.adminAssignmentEmail);

module.exports = router;
