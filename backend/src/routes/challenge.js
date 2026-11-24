const express = require('express');
const router = express.Router();
const controller = require('../controllers/challengeController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
// The monthly challenge is shared by every college and managed by the main admin only.
const { requireSuperAdmin: superAdminOnly } = require('../controllers/collegeController');

router.get('/', requireAuth, controller.list);
router.get('/current', requireAuth, controller.current);
router.get('/:id', requireAuth, requireRole('ADMIN'), superAdminOnly, controller.get);
router.post('/', requireAuth, requireRole('ADMIN'), superAdminOnly, controller.create);
router.put('/:id', requireAuth, requireRole('ADMIN'), superAdminOnly, controller.update);
router.delete('/:id', requireAuth, requireRole('ADMIN'), superAdminOnly, controller.remove);

module.exports = router;
