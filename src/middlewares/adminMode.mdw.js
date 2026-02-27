function adminModeMiddleware(req, res, next) {
  res.locals.isAdminMode = true;
  next();
}

export default adminModeMiddleware;