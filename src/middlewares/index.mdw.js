import initAuth from '../middlewares/initAuth.mdw.js';
import injectLocals from '../middlewares/injectLocals.mdw.js';
import syncUserSession from '../middlewares/syncUserSession.mdw.js';
import categoryMiddleware from '../middlewares/category.mdw.js';
import adminModeMiddleware from '../middlewares/adminMode.mdw.js';
import { isAdmin } from '../middlewares/auth.mdw.js';

function middlewareConfig(app) {
  app.use(initAuth);
  app.use(syncUserSession);
  app.use(injectLocals);
  app.use(categoryMiddleware);

  app.use('/admin', isAdmin);
  app.use('/admin', adminModeMiddleware);
}

export default middlewareConfig;