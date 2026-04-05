const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, controller.list);
router.post('/:id/read', requireAuth, controller.markRead);

module.exports = router;
