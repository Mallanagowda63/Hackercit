const express = require('express');
const router = express.Router();
const controller = require('../controllers/testController');
const assessmentController = require('../controllers/assessmentController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole('ADMIN'), controller.list);
router.get('/active', requireAuth, controller.active);
router.post('/', requireAuth, requireRole('ADMIN'), controller.create);
router.post('/:id/start', requireAuth, requireRole('ADMIN'), controller.start);
router.post('/:id/stop', requireAuth, requireRole('ADMIN'), controller.stop);
router.post('/:id/submit', requireAuth, assessmentController.submitAssessment);
router.get('/:id/result', requireAuth, assessmentController.getAssessmentResult);
router.post('/:id/attempts/start', requireAuth, controller.startAttempt);
router.post('/:id/attempts/interrupt', requireAuth, controller.recordInterruption);
router.post('/:id/attempts/finish', requireAuth, controller.finishAttempt);
router.get('/:id/report', requireAuth, requireRole('ADMIN'), controller.report);

module.exports = router;
