import express from 'express';
import * as systemController from '../../controller/admin/system.controller.js';
const router = express.Router();

router.get('/settings', systemController.getSystemSettings);

router.post('/settings', systemController.updateSystemSettings);

export default router;
