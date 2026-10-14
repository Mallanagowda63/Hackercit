const express = require('express');
const router = express.Router();
const controller = require('../controllers/problemController');
const { invalidateLiveSnapshot } = require('../controllers/testController');

// Question changes clear the cached problem list and the live-test data, once the change is done.
const clearsProblemCaches = (req, res, next) => {
  res.on('finish', () => {
    controller.clearProblemListCache();
    invalidateLiveSnapshot();
  });
  next();
};
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', controller.list);
router.post('/import', requireAuth, requireRole('ADMIN'), clearsProblemCaches, controller.importMany);
router.post('/upload-mcq-pdf', requireAuth, requireRole('SETTER'), controller.uploadMcqPdf);
router.post('/import-mcq-bulk', requireAuth, requireRole('SETTER'), clearsProblemCaches, controller.importBulkMcqs);
router.get('/:slug', controller.get);
router.post('/', requireAuth, requireRole('SETTER'), clearsProblemCaches, controller.create);
router.put('/:id', requireAuth, requireRole('SETTER'), clearsProblemCaches, controller.update);
router.delete('/:id', requireAuth, requireRole('SETTER'), clearsProblemCaches, controller.remove);

module.exports = router;
