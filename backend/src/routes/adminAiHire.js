const express = require('express');
const router = express.Router();
const controller = require('../controllers/aiHireController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/interviews', requireAuth, requireRole('ADMIN'), controller.adminList);
router.get('/interviews/:id', requireAuth, requireRole('ADMIN'), controller.adminItem);
router.get('/assignments', requireAuth, requireRole('ADMIN'), controller.adminListAssignments);
router.post('/assignments', requireAuth, requireRole('ADMIN'), controller.adminCreateAssignment);
router.post('/assignments/:id/close', requireAuth, requireRole('ADMIN'), controller.adminCloseAssignment);

module.exports = router;
