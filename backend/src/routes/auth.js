const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/verify', controller.verifyEmail);
router.post('/forgot', controller.forgotPassword);
router.post('/reset', controller.resetPassword);
router.get('/me', controller.me);
router.get('/students', requireAuth, requireRole('ADMIN'), controller.listStudents);
router.get('/login-events', requireAuth, requireRole('ADMIN'), controller.listLoginEvents);

module.exports = router;
