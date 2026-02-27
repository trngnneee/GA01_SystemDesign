import { engine } from 'express-handlebars';
import expressHandlebarsSections from 'express-handlebars-sections';
import path from 'path';
import indexHelper from '../helpers/index.helper.js';

function viewEngineConfig(app, __dirname) {
  app.engine('handlebars', engine({
    defaultLayout: 'main',
    helpers: {
      section: expressHandlebarsSections(),
      indexHelper,
    },
    partialsDir: [
      path.join(__dirname, 'views/partials'),
      path.join(__dirname, 'views/vwAccount')
    ]
  }));
  app.set('view engine', 'handlebars');
  app.set('views', './views');
}

export default viewEngineConfig;