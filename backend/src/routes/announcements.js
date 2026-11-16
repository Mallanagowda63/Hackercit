const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/status', requireAuth, requireRole('ADMIN'), controller.status);
router.post('/email', requireAuth, requireRole('ADMIN'), controller.send);

module.exports = router;
