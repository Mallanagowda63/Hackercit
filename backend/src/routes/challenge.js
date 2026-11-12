const express = require('express');
const router = express.Router();
const controller = require('../controllers/challengeController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', requireAuth, controller.list);
router.get('/current', requireAuth, controller.current);
router.get('/:id', requireAuth, requireRole('ADMIN'), controller.get);
router.post('/', requireAuth, requireRole('ADMIN'), controller.create);
router.put('/:id', requireAuth, requireRole('ADMIN'), controller.update);
router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.remove);

module.exports = router;
