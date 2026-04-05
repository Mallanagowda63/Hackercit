const express = require('express');
const router = express.Router();
const controller = require('../controllers/submissionController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/run', requireAuth, controller.runSample);
router.post('/submit', requireAuth, controller.submit);
router.get('/leaderboard', requireAuth, controller.leaderboard);
router.get('/user/:userId', requireAuth, controller.listByUser);

module.exports = router;
