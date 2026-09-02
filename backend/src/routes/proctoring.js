const express = require('express');
const router = express.Router();
const proctoringController = require('../controllers/proctoringController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

router.post('/events', proctoringController.recordEvent);

module.exports = router;
