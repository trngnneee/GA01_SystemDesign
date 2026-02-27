import 'dotenv/config';
import express from 'express';

import path from 'path';
import { fileURLToPath } from 'url';

// Import Config
import expressConfig from './config/express.config.js';
import sessionConfig from './config/session.config.js';
import passportConfig from './config/passport.config.js';
import viewEngineConfig from './config/viewEngine.config.js';
import middlewareConfig from './middlewares/index.mdw.js';
import routeConfig from './routes/index.route.js';

// Utils
import ensureDir from './utils/ensureDir.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================
// 1. CẤU HÌNH CỐT LÕI
// ============================================================
expressConfig(app);
sessionConfig(app);
passportConfig(app);

// ============================================================
// 2. CẤU HÌNH VIEW ENGINE (Handlebars)
// ============================================================
viewEngineConfig(app, __dirname);

// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(__dirname, 'public', 'images', 'products');
ensureDir(uploadDir);

// ============================================================
// 3. MIDDLEWARE TOÀN CỤC (Chạy cho mọi request)
// ============================================================
middlewareConfig(app);

// ============================================================
// 5. ROUTES
// ============================================================
routeConfig(app);

export default app;