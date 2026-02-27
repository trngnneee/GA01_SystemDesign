import express from 'express';
import * as userController from '../../controller/admin/user.controller.js';
const router = express.Router();

router.get('/list', userController.listUsersGet);
router.get('/detail/:id', userController.userDetailGet);
router.get('/add', userController.addUserGet);
router.post('/add', userController.addUserPost);
router.get('/edit/:id', userController.showEditUserForm);
router.post('/edit', userController.editUser);
router.post('/reset-password', userController.resetPassword);
router.post('/delete', userController.deleteUser);
router.get('/upgrade-requests', userController.listUpgradeRequests);
router.post('/upgrade/approve', userController.approveUpgrade);
router.post('/upgrade/reject', userController.rejectUpgrade);

export default router;