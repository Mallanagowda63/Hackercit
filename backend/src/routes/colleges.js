const express = require('express');
const router = express.Router();
const controller = require('../controllers/collegeController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const superAdmin = [requireAuth, requireRole('ADMIN'), controller.requireSuperAdmin];

router.get('/', controller.publicList);
router.get('/manage', ...superAdmin, controller.manageList);
router.get('/mine', requireAuth, requireRole('ADMIN'), controller.mine);
router.get('/check', ...superAdmin, controller.check);
router.get('/:id/export', requireAuth, requireRole('ADMIN'), controller.exportCollege);
router.post('/', ...superAdmin, controller.create);
router.put('/:id', ...superAdmin, controller.rename);
router.delete('/:id', ...superAdmin, controller.remove);
router.post('/:id/admins', ...superAdmin, controller.createAdmin);
// The main admin, or that college's own admin (checked in the controller).
router.post('/:id/move-students', requireAuth, requireRole('ADMIN'), controller.moveStudents);
router.post('/:id/remove-students', requireAuth, requireRole('ADMIN'), controller.removeStudents);
router.post('/admins/:userId/password', ...superAdmin, controller.resetAdminPassword);
router.delete('/admins/:userId', ...superAdmin, controller.removeAdmin);

module.exports = router;
