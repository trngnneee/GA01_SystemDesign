import express from 'express';
import * as productController from '../../controller/admin/product.controller.js';
import multer from 'multer';
import { storage } from '../../config/multer.config.js';

const upload = multer({ storage: storage });
const router = express.Router();

router.get('/list', productController.listProducts);

router.get('/add', productController.showAddProductForm);

router.post('/add', productController.addProduct);

router.get('/detail/:id', productController.getProductDetail);

router.get('/edit/:id', productController.showEditProductForm);

router.post('/edit', productController.editProduct);

router.post('/delete', productController.deleteProduct);

router.post('/upload-thumbnail', upload.single('thumbnail'), async function (req, res) {
    res.json({
        success: true,
        file: req.file
    });
});

router.post('/upload-subimages', upload.array('images', 10), async function (req, res) {
    res.json({
        success: true,
        files: req.files
    });
});

export default router;