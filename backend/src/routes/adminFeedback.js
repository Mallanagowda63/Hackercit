const express = require('express');
const router = express.Router();
const controller = require('../controllers/feedbackController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole('ADMIN'), controller.listAllFeedback);
router.get('/new-count', requireAuth, requireRole('ADMIN'), controller.newFeedbackCount);
router.post('/mark-seen', requireAuth, requireRole('ADMIN'), controller.markFeedbackSeen);

module.exports = router;
