const express = require('express');
const router = express.Router();
const controller = require('../controllers/problemController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', controller.list);
router.post('/import', requireAuth, requireRole('ADMIN'), controller.importMany);
router.get('/:slug', controller.get);
router.post('/', requireAuth, requireRole('SETTER'), controller.create);
router.put('/:id', requireAuth, requireRole('SETTER'), controller.update);
router.delete('/:id', requireAuth, requireRole('SETTER'), controller.remove);

module.exports = router;
