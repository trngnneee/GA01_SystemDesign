import passport from './utils/passport.js';

function passportConfig(app) {
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
}

export default passportConfig;