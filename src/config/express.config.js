import express from 'express';
import methodOverride from 'method-override';

function expressConfig(app) {
  app.use('/static', express.static('public'));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(methodOverride('_method'));
}

export default expressConfig;