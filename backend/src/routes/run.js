const express = require('express');
const router = express.Router();
const controller = require('../controllers/runController');

router.post('/', controller.run);
router.get('/health', controller.health);

module.exports = router;
