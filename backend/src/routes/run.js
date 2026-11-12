const express = require('express');
const router = express.Router();
const controller = require('../controllers/runController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', controller.run);
router.post('/playground', requireAuth, controller.playground);
router.get('/health', controller.health);

module.exports = router;
