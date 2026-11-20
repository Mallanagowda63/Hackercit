const express = require('express');
const router = express.Router();
const controller = require('../controllers/aiHireController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/status', requireAuth, controller.status);
router.post('/start', requireAuth, controller.start);
router.post('/evaluate', requireAuth, controller.evaluate);
router.post('/report', requireAuth, controller.report);
router.get('/jobs/:id', requireAuth, controller.job);
router.post('/feedback', requireAuth, controller.feedback);
router.get('/history', requireAuth, controller.history);
router.get('/assignments', requireAuth, controller.studentAssignments);
router.get('/history/:id', requireAuth, controller.historyItem);

module.exports = router;
