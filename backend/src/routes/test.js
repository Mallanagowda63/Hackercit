const express = require('express');
const router = express.Router();
const controller = require('../controllers/testController');
const feedbackController = require('../controllers/feedbackController');
const assessmentController = require('../controllers/assessmentController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole('ADMIN'), controller.list);
router.get('/active', requireAuth, controller.active);
router.post('/', requireAuth, requireRole('ADMIN'), controller.create);
router.post('/:id/start', requireAuth, requireRole('ADMIN'), controller.start);
router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.remove);
router.post('/:id/schedule', requireAuth, requireRole('ADMIN'), controller.schedule);
router.post('/:id/unschedule', requireAuth, requireRole('ADMIN'), controller.unschedule);
router.post('/:id/stop', requireAuth, requireRole('ADMIN'), controller.stop);
router.post('/:id/submit', requireAuth, assessmentController.submitAssessment);
router.get('/:id/result', requireAuth, assessmentController.getAssessmentResult);
router.post('/:id/attempts/start', requireAuth, controller.startAttempt);
router.post('/:id/attempts/interrupt', requireAuth, controller.recordInterruption);
router.post('/:id/attempts/finish', requireAuth, controller.finishAttempt);
router.get('/:id/report', requireAuth, requireRole('ADMIN'), controller.report);
router.post('/:id/feedback', requireAuth, feedbackController.submitFeedback);
router.get('/:id/feedback', requireAuth, requireRole('ADMIN'), feedbackController.listFeedback);

module.exports = router;
