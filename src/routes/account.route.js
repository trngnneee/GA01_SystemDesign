import express from 'express';
import passport from '../utils/passport.js';
import * as accountController from '../controller/account.controller.js';
import { isAuthenticated } from '../middlewares/auth.mdw.js';

const router = express.Router();

router.get('/ratings', isAuthenticated, accountController.getRatings);

// GET /signup
router.get('/signup', accountController.showSignupForm);

// GET /signin
router.get('/signin', accountController.showSigninForm);

// GET /verify-email?email=...
router.get('/verify-email', accountController.showVerifyEmailForm);

router.get('/forgot-password', accountController.showForgotPasswordForm);
router.post('/forgot-password', accountController.forgotPassword);
router.post('/verify-forgot-password-otp', accountController.verifyForgotPasswordOtp);
router.post('/resend-forgot-password-otp', accountController.resendForgotPasswordOtp);
router.post('/reset-password', accountController.resetPassword);

// POST /signin
router.post('/signin', accountController.signin);

// POST /signup
router.post('/signup', accountController.signup);

// POST /verify-email
router.post('/verify-email', accountController.verifyEmail);

// POST /resend-otp
router.post('/resend-otp', accountController.resendOtp);

// GET /profile - HIỂN THỊ PROFILE & THÔNG BÁO
router.get('/profile', isAuthenticated, accountController.getProfile);

// PUT /profile - XỬ LÝ UPDATE
router.put('/profile', isAuthenticated, accountController.updateProfile);

router.post('/logout', isAuthenticated, accountController.logout);

router.get('/request-upgrade', isAuthenticated, accountController.showRequestUpgradeForm);
router.post('/request-upgrade', isAuthenticated, accountController.requestUpgrade);

router.get('/watchlist', isAuthenticated, accountController.getWatchlist);

// Bidding Products - Sản phẩm đang tham gia đấu giá
router.get('/bidding', isAuthenticated, accountController.getBiddingProducts);

// Won Auctions - Sản phẩm đã thắng (pending, sold, cancelled)
router.get('/auctions', isAuthenticated, accountController.getWonAuctions);

// Rate Seller - POST
router.post('/won-auctions/:productId/rate-seller', isAuthenticated, accountController.rateSeller);

// Rate Seller - PUT (Edit)
router.put('/won-auctions/:productId/rate-seller', isAuthenticated, accountController.updateSellerRating);

router.get('/seller/products', isAuthenticated, accountController.getSellerProducts);

router.get('/seller/sold-products', isAuthenticated, accountController.getSoldProducts);

// ===================== OAUTH ROUTES =====================

// Google OAuth
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/account/signin' }),
  accountController.googleAuthCallback
);

// Facebook OAuth
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['public_profile'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/account/signin' }),
  accountController.facebookAuthCallback
);

// Twitter OAuth - DISABLED (Twitter API requires $100/month subscription)
// router.get('/auth/twitter',
//   passport.authenticate('twitter')
// );

// router.get('/auth/twitter/callback',
//   passport.authenticate('twitter', { failureRedirect: '/account/signin' }),
//   (req, res) => {
//     req.session.authUser = req.user;
//     req.session.isAuthenticated = true;
//     res.redirect('/');
//   }
// );

// GitHub OAuth
router.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/account/signin' }),
  accountController.githubAuthCallback
);

export default router;
