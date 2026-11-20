const express = require('express');
const router = express.Router();
const controller = require('../controllers/aiHireController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/interviews', requireAuth, requireRole('ADMIN'), controller.adminList);
router.get('/interviews/:id', requireAuth, requireRole('ADMIN'), controller.adminItem);

module.exports = router;
