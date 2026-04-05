const express = require('express');
const router = express.Router();
const controller = require('../controllers/testController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, requireRole('ADMIN'), controller.list);
router.get('/active', requireAuth, controller.active);
router.post('/', requireAuth, requireRole('ADMIN'), controller.create);
router.post('/:id/start', requireAuth, requireRole('ADMIN'), controller.start);

module.exports = router;
