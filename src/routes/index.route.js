import apiRouter from '../routes/api.route.js';
import homeRouter from '../routes/home.route.js';
import productRouter from '../routes/product.route.js';
import accountRouter from '../routes/account.route.js';
import adminCategoryRouter from '../routes/admin/category.route.js';
import adminUserRouter from '../routes/admin/user.route.js';
import adminAccountRouter from '../routes/admin/account.route.js';
import adminProductRouter from '../routes/admin/product.route.js';
import adminSystemRouter from '../routes/admin/system.route.js';
import sellerRouter from '../routes/seller.route.js';

// Import Middlewares
import { isAuthenticated, isSeller } from '../middlewares/auth.mdw.js';

function routeConfig(app) {
  // Các Route Admin
  app.use('/admin/account', adminAccountRouter);
  app.use('/admin/users', adminUserRouter);
  app.use('/admin/categories', adminCategoryRouter);
  app.use('/admin/products', adminProductRouter);
  app.use('/admin/system', adminSystemRouter);
  // Các Route Seller
  app.use('/seller', isAuthenticated, isSeller, sellerRouter);

  // API endpoint for categories (for search modal)
  app.use('/api', apiRouter);

  // Các Route Client (Đặt cuối cùng để tránh override)
  app.use('/', homeRouter);
  app.use('/products', productRouter);
  app.use('/account', accountRouter);
}

export default routeConfig;