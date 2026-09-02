const express = require('express');
const router = express.Router();
const controller = require('../controllers/reportsController');
const proctoringController = require('../controllers/proctoringController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/tests', controller.listReportsOverview);
router.get('/tests/:testId', controller.getTestReport);
router.get('/tests/:testId/students/:studentId', controller.getStudentDetailReport);
router.get('/submissions/:submissionId', controller.getCodingSubmissionDetail);

// Proctoring & Malpractice Reports
router.get('/proctoring', proctoringController.getReports);
router.get('/proctoring/export', proctoringController.exportReportsCSV);
router.post('/proctoring/attempts/:attemptId/review', proctoringController.reviewAttempt);

module.exports = router;
