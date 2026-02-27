function injectLocals(req, res, next) {
  res.locals.isAuthenticated = req.session.isAuthenticated;
  res.locals.authUser = req.session.authUser;
  res.locals.isAdmin = req.session.authUser?.role === 'admin';
  res.locals.isSeller = req.session.authUser?.role === 'seller';
  next();
}

export default injectLocals;