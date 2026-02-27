import express from 'express';
import * as categoryController from '../../controller/admin/category.controller.js';
const router = express.Router();

// Define your admin category routes here

router.get('/list', categoryController.listCategories);
router.get('/detail/:id', categoryController.getCategoryDetail);
router.get('/add', categoryController.showAddCategoryForm);
router.get('/edit/:id', categoryController.showEditCategoryForm);
router.post('/add', categoryController.addCategory);
router.post('/edit', categoryController.editCategory);
router.post('/delete', categoryController.deleteCategory);

export default router;