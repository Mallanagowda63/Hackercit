const express = require('express');
const router = express.Router();
const controller = require('../controllers/reportsController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/tests', controller.listReportsOverview);
router.get('/tests/:testId', controller.getTestReport);
router.get('/tests/:testId/students/:studentId', controller.getStudentDetailReport);
router.get('/submissions/:submissionId', controller.getCodingSubmissionDetail);

module.exports = router;
