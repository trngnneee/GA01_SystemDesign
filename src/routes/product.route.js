import express from "express";
import { isAuthenticated } from "../middlewares/auth.mdw.js";
import * as productController from "../controller/product.controller.js";

const router = express.Router();

router.get("/category", productController.getCategoryProducts);
router.get("/search", productController.searchProducts);
router.get("/detail", productController.getProductDetail);
router.get(
  "/bidding-history",
  isAuthenticated,
  productController.getBiddingHistoryPage,
);

// Watchlist
router.post("/watchlist", isAuthenticated, productController.addToWatchlist);
router.delete(
  "/watchlist",
  isAuthenticated,
  productController.removeFromWatchlist,
);

// Bidding
router.post("/bid", isAuthenticated, productController.placeBid);

// Comments
router.post("/comment", isAuthenticated, productController.postComment);

// Bid history API
router.get("/bid-history/:productId", productController.getBidHistory);

// Complete Order
router.get(
  "/complete-order",
  isAuthenticated,
  productController.getCompleteOrder,
);

// Image upload
router.post(
  "/order/upload-images",
  isAuthenticated,
  productController.upload.array("images", 5),
  productController.uploadImages,
);

// Order actions
router.post(
  "/order/:orderId/submit-payment",
  isAuthenticated,
  productController.submitPayment,
);
router.post(
  "/order/:orderId/confirm-payment",
  isAuthenticated,
  productController.confirmPayment,
);
router.post(
  "/order/:orderId/submit-shipping",
  isAuthenticated,
  productController.submitShipping,
);
router.post(
  "/order/:orderId/confirm-delivery",
  isAuthenticated,
  productController.confirmDelivery,
);
router.post(
  "/order/:orderId/submit-rating",
  isAuthenticated,
  productController.submitRating,
);
router.post(
  "/order/:orderId/complete-transaction",
  isAuthenticated,
  productController.completeTransaction,
);

// Order chat
router.post(
  "/order/:orderId/send-message",
  isAuthenticated,
  productController.sendMessage,
);
router.get(
  "/order/:orderId/messages",
  isAuthenticated,
  productController.getMessages,
);

// Reject / Unreject bidder
router.post("/reject-bidder", isAuthenticated, productController.rejectBidder);
router.post(
  "/unreject-bidder",
  isAuthenticated,
  productController.unrejectBidder,
);

// Buy Now
router.post("/buy-now", isAuthenticated, productController.buyNow);

// Ratings pages
router.get("/seller/:sellerId/ratings", productController.getSellerRatings);
router.get("/bidder/:bidderId/ratings", productController.getBidderRatings);

export default router;
