import * as productModel from "../models/product.model.js";
import * as reviewModel from "../models/review.model.js";
import * as userModel from "../models/user.model.js";
import * as watchListModel from "../models/watchlist.model.js";
import * as biddingHistoryModel from "../models/biddingHistory.model.js";
import * as productCommentModel from "../models/productComment.model.js";
import * as categoryModel from "../models/category.model.js";
import * as productDescUpdateModel from "../models/productDescriptionUpdate.model.js";
import * as autoBiddingModel from "../models/autoBidding.model.js";
import * as systemSettingModel from "../models/systemSetting.model.js";
import * as rejectedBidderModel from "../models/rejectedBidder.model.js";
import * as orderModel from "../models/order.model.js";
import * as invoiceModel from "../models/invoice.model.js";
import * as orderChatModel from "../models/orderChat.model.js";
import { sendMail } from "../utils/mailer.js";
import {
  bidNotifySeller,
  bidNotifyBidder,
  bidNotifyOutbid,
  bidRejectedNotify,
  commentNotify,
  sellerReplyBroadcast,
} from "../helpers/emailTemplates.helper.js";
import { resolveProductStatus } from "../helpers/product.helper.js";
import { paginate } from "../helpers/pagination.helper.js";
import { parsePgArray } from "../helpers/string.helper.js";
import { buildProductUrl } from "../helpers/common.helper.js";
import { getUserRatingInfo } from "../models/review.model.js";
import db from "../utils/db.js";
import { upload } from "../helpers/upload.helper.js";
export { upload };

// ===================== HELPERS =====================

const prepareProductList = async (products) => {
  const now = new Date();
  if (!products) return [];

  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;

  return products.map((product) => {
    const created = new Date(product.created_at);
    const isNew = now - created < N_MINUTES * 60 * 1000;
    return { ...product, is_new: isNew };
  });
};

// ===================== CONTROLLERS =====================

export async function getCategoryProducts(req, res) {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const sort = req.query.sort || "";
  const categoryId = req.query.catid;
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;

  const category = await categoryModel.findByCategoryId(categoryId);

  let categoryIds = [categoryId];

  if (category && category.parent_id === null) {
    const childCategories =
      await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map((cat) => cat.id);
    categoryIds = [categoryId, ...childIds];
  }

  const list = await productModel.findByCategoryIds(
    categoryIds,
    limit,
    offset,
    sort,
    userId,
  );
  const products = await prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);
  console.log("Total products in category:", total.count);
  const totalCount = parseInt(total.count) || 0;
  const { totalPages: nPages, from, to } = paginate(totalCount, page, limit);

  res.render("vwProduct/list", {
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    categoryId,
    categoryName: category ? category.name : null,
    sort,
  });
}

export async function searchProducts(req, res) {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const q = req.query.q || "";
  const logic = req.query.logic || "and";
  const sort = req.query.sort || "";

  if (q.length === 0) {
    return res.render("vwProduct/list", {
      q,
      logic,
      sort,
      products: [],
      totalCount: 0,
      from: 0,
      to: 0,
      currentPage: 1,
      totalPages: 0,
    });
  }

  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const keywords = q.trim();

  const list = await productModel.searchPageByKeywords(
    keywords,
    limit,
    offset,
    userId,
    logic,
    sort,
  );
  const products = await prepareProductList(list);
  const total = await productModel.countByKeywords(keywords, logic);
  const totalCount = parseInt(total.count) || 0;
  const { totalPages: nPages, from, to } = paginate(totalCount, page, limit);

  res.render("vwProduct/list", {
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    q,
    logic,
    sort,
  });
}

export async function getProductDetail(req, res) {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;
  const product = await productModel.findByProductId2(productId, userId);
  const related_products = await productModel.findRelatedProducts(productId);

  if (!product) {
    return res.status(404).render("404", { message: "Product not found" });
  }

  const now = new Date();
  const endDate = new Date(product.end_at);

  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(productId, { closed_at: endDate });
    product.closed_at = endDate;
  }

  const productStatus = resolveProductStatus(product);

  if (productStatus !== "ACTIVE") {
    if (!userId) {
      return res.status(403).render("403", {
        message: "You do not have permission to view this product",
      });
    }

    const isSeller = product.seller_id === userId;
    const isHighestBidder = product.highest_bidder_id === userId;

    if (!isSeller && !isHighestBidder) {
      return res.status(403).render("403", {
        message: "You do not have permission to view this product",
      });
    }
  }

  const commentPage = parseInt(req.query.commentPage) || 1;
  const commentsPerPage = 2;
  const offset = (commentPage - 1) * commentsPerPage;

  const [descriptionUpdates, biddingHistory, comments, totalComments] =
    await Promise.all([
      productDescUpdateModel.findByProductId(productId),
      biddingHistoryModel.getBiddingHistory(productId),
      productCommentModel.getCommentsByProductId(
        productId,
        commentsPerPage,
        offset,
      ),
      productCommentModel.countCommentsByProductId(productId),
    ]);

  let rejectedBidders = [];
  if (req.session.authUser && product.seller_id === req.session.authUser.id) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }

  if (comments.length > 0) {
    const commentIds = comments.map((c) => c.id);
    const allReplies =
      await productCommentModel.getRepliesByCommentIds(commentIds);

    const repliesMap = new Map();
    for (const reply of allReplies) {
      if (!repliesMap.has(reply.parent_id)) {
        repliesMap.set(reply.parent_id, []);
      }
      repliesMap.get(reply.parent_id).push(reply);
    }

    for (const comment of comments) {
      comment.replies = repliesMap.get(comment.id) || [];
    }
  }

  const totalPages = Math.ceil(totalComments / commentsPerPage);

  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;

  const sellerInfo = await getUserRatingInfo(product.seller_id);
  let bidderInfo = { rating_point: null, reviews: [], has_reviews: false };
  if (product.highest_bidder_id) {
    bidderInfo = await getUserRatingInfo(product.highest_bidder_id);
  }

  let showPaymentButton = false;
  if (req.session.authUser && productStatus === "PENDING") {
    const uid = req.session.authUser.id;
    showPaymentButton =
      product.seller_id === uid || product.highest_bidder_id === uid;
  }

  res.render("vwProduct/details", {
    product,
    productStatus,
    authUser: req.session.authUser,
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,
    comments,
    success_message,
    error_message,
    related_products,
    seller_rating_point: sellerInfo.rating_point,
    seller_has_reviews: sellerInfo.has_reviews,
    bidder_rating_point: bidderInfo.rating_point,
    bidder_has_reviews: bidderInfo.has_reviews,
    commentPage,
    totalPages,
    totalComments,
    showPaymentButton,
  });
}

export async function getBiddingHistoryPage(req, res) {
  const productId = req.query.id;

  if (!productId) {
    return res.redirect("/");
  }

  try {
    const product = await productModel.findByProductId2(productId, null);

    if (!product) {
      return res.status(404).render("404", { message: "Product not found" });
    }

    const biddingHistory =
      await biddingHistoryModel.getBiddingHistory(productId);

    res.render("vwProduct/biddingHistory", { product, biddingHistory });
  } catch (error) {
    console.error("Error loading bidding history:", error);
    res
      .status(500)
      .render("500", { message: "Unable to load bidding history" });
  }
}

export async function addToWatchlist(req, res) {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);
  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }

  const retUrl = req.headers.referer || "/";
  res.redirect(retUrl);
}

export async function removeFromWatchlist(req, res) {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await watchListModel.removeFromWatchlist(userId, productId);

  const retUrl = req.headers.referer || "/";
  res.redirect(retUrl);
}

export async function placeBid(req, res) {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ""));

  try {
    const result = await db.transaction(async (trx) => {
      const product = await trx("products")
        .where("id", productId)
        .forUpdate()
        .first();

      if (!product) throw new Error("Product not found");

      const previousHighestBidderId = product.highest_bidder_id;
      const previousPrice = parseFloat(
        product.current_price || product.starting_price,
      );

      if (product.is_sold === true)
        throw new Error("This product has already been sold");
      if (product.seller_id === userId)
        throw new Error("You cannot bid on your own product");

      const isRejected = await trx("rejected_bidders")
        .where("product_id", productId)
        .where("bidder_id", userId)
        .first();
      if (isRejected)
        throw new Error(
          "You have been rejected from bidding on this product by the seller",
        );

      const { rating_point: ratingPoint, reviews: userReviews } =
        await getUserRatingInfo(userId);
      const hasReviews = userReviews.length > 0;

      if (!hasReviews) {
        if (!product.allow_unrated_bidder)
          throw new Error(
            "This seller does not allow unrated bidders to bid on this product.",
          );
      } else if (ratingPoint.rating_point <= 0) {
        throw new Error(
          "You are not eligible to place bids due to your rating.",
        );
      } else if (ratingPoint.rating_point <= 0.8) {
        throw new Error(
          "Your rating point is not greater than 80%. You cannot place bids.",
        );
      }

      const now = new Date();
      const endDate = new Date(product.end_at);
      if (now > endDate) throw new Error("Auction has ended");

      const currentPrice = parseFloat(
        product.current_price || product.starting_price,
      );
      if (bidAmount <= currentPrice)
        throw new Error(
          `Bid must be higher than current price (${currentPrice.toLocaleString()} VND)`,
        );

      const minIncrement = parseFloat(product.step_price);
      if (bidAmount < currentPrice + minIncrement) {
        throw new Error(
          `Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`,
        );
      }

      let extendedEndTime = null;
      if (product.auto_extend) {
        const settings = await systemSettingModel.getSettings();
        const triggerMinutes = settings?.auto_extend_trigger_minutes;
        const extendMinutes = settings?.auto_extend_duration_minutes;
        const endTime = new Date(product.end_at);
        const minutesRemaining = (endTime - now) / (1000 * 60);

        if (minutesRemaining <= triggerMinutes) {
          extendedEndTime = new Date(
            endTime.getTime() + extendMinutes * 60 * 1000,
          );
          product.end_at = extendedEndTime;
        }
      }

      let newCurrentPrice, newHighestBidderId, newHighestMaxPrice;
      let shouldCreateHistory = true;
      const buyNowPrice = product.buy_now_price
        ? parseFloat(product.buy_now_price)
        : null;
      let buyNowTriggered = false;

      if (
        buyNowPrice &&
        product.highest_bidder_id &&
        product.highest_max_price &&
        product.highest_bidder_id !== userId
      ) {
        const currentHighestMaxPrice = parseFloat(product.highest_max_price);
        if (currentHighestMaxPrice >= buyNowPrice) {
          newCurrentPrice = buyNowPrice;
          newHighestBidderId = product.highest_bidder_id;
          newHighestMaxPrice = currentHighestMaxPrice;
          buyNowTriggered = true;
        }
      }

      if (!buyNowTriggered) {
        if (product.highest_bidder_id === userId) {
          newCurrentPrice = parseFloat(
            product.current_price || product.starting_price,
          );
          newHighestBidderId = userId;
          newHighestMaxPrice = bidAmount;
          shouldCreateHistory = false;
        } else if (!product.highest_bidder_id || !product.highest_max_price) {
          newCurrentPrice = product.starting_price;
          newHighestBidderId = userId;
          newHighestMaxPrice = bidAmount;
        } else {
          const currentHighestMaxPrice = parseFloat(product.highest_max_price);
          const currentHighestBidderId = product.highest_bidder_id;

          if (bidAmount < currentHighestMaxPrice) {
            newCurrentPrice = bidAmount;
            newHighestBidderId = currentHighestBidderId;
            newHighestMaxPrice = currentHighestMaxPrice;
          } else if (bidAmount === currentHighestMaxPrice) {
            newCurrentPrice = bidAmount;
            newHighestBidderId = currentHighestBidderId;
            newHighestMaxPrice = currentHighestMaxPrice;
          } else {
            newCurrentPrice = currentHighestMaxPrice + minIncrement;
            newHighestBidderId = userId;
            newHighestMaxPrice = bidAmount;
          }
        }

        if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
          newCurrentPrice = buyNowPrice;
          buyNowTriggered = true;
        }
      }

      let productSold = buyNowTriggered;

      const updateData = {
        current_price: newCurrentPrice,
        highest_bidder_id: newHighestBidderId,
        highest_max_price: newHighestMaxPrice,
      };

      if (productSold) {
        updateData.end_at = new Date();
        updateData.closed_at = new Date();
      } else if (extendedEndTime) {
        updateData.end_at = extendedEndTime;
      }

      await trx("products").where("id", productId).update(updateData);

      if (shouldCreateHistory) {
        await trx("bidding_history").insert({
          product_id: productId,
          bidder_id: newHighestBidderId,
          current_price: newCurrentPrice,
        });
      }

      await trx.raw(
        `
        INSERT INTO auto_bidding (product_id, bidder_id, max_price)
        VALUES (?, ?, ?)
        ON CONFLICT (product_id, bidder_id)
        DO UPDATE SET max_price = EXCLUDED.max_price, created_at = NOW()
      `,
        [productId, userId, bidAmount],
      );

      return {
        newCurrentPrice,
        newHighestBidderId,
        userId,
        bidAmount,
        productSold,
        autoExtended: !!extendedEndTime,
        newEndTime: extendedEndTime,
        productName: product.name,
        sellerId: product.seller_id,
        previousHighestBidderId,
        previousPrice,
        priceChanged: previousPrice !== newCurrentPrice,
      };
    });

    const productUrl = buildProductUrl(req, productId);

    (async () => {
      try {
        const [seller, currentBidder, previousBidder] = await Promise.all([
          userModel.findById(result.sellerId),
          userModel.findById(result.userId),
          result.previousHighestBidderId &&
          result.previousHighestBidderId !== result.userId
            ? userModel.findById(result.previousHighestBidderId)
            : null,
        ]);

        const emailPromises = [];

        if (seller && seller.email) {
          emailPromises.push(
            sendMail({
              to: seller.email,
              subject: `💰 New bid on your product: ${result.productName}`,
              html: bidNotifySeller({
                sellerName: seller.fullname,
                productName: result.productName,
                bidderName: currentBidder
                  ? currentBidder.fullname
                  : "Anonymous",
                newPrice: result.newCurrentPrice,
                previousPrice: result.previousPrice,
                productSold: result.productSold,
                productUrl,
              }),
            }),
          );
        }

        if (currentBidder && currentBidder.email) {
          const isWinning = result.newHighestBidderId === result.userId;
          emailPromises.push(
            sendMail({
              to: currentBidder.email,
              subject: isWinning
                ? `✅ You're winning: ${result.productName}`
                : `📊 Bid placed: ${result.productName}`,
              html: bidNotifyBidder({
                bidderName: currentBidder.fullname,
                productName: result.productName,
                isWinning,
                bidAmount: result.bidAmount,
                newPrice: result.newCurrentPrice,
                productSold: result.productSold,
                productUrl,
              }),
            }),
          );
        }

        if (previousBidder && previousBidder.email && result.priceChanged) {
          const wasOutbid =
            result.newHighestBidderId !== result.previousHighestBidderId;
          emailPromises.push(
            sendMail({
              to: previousBidder.email,
              subject: wasOutbid
                ? `⚠️ You've been outbid: ${result.productName}`
                : `📊 Price updated: ${result.productName}`,
              html: bidNotifyOutbid({
                bidderName: previousBidder.fullname,
                productName: result.productName,
                wasOutbid,
                newPrice: result.newCurrentPrice,
                previousPrice: result.previousPrice,
                productUrl,
              }),
            }),
          );
        }

        if (emailPromises.length > 0) {
          await Promise.all(emailPromises);
          console.log(
            `${emailPromises.length} bid notification email(s) sent for product #${productId}`,
          );
        }
      } catch (emailError) {
        console.error("Failed to send bid notification emails:", emailError);
      }
    })();

    let baseMessage = "";
    if (result.productSold) {
      if (result.newHighestBidderId === result.userId) {
        baseMessage = `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Please proceed to payment.`;
      } else {
        baseMessage = `Product has been sold to another bidder at Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Your bid helped reach the Buy Now threshold.`;
      }
    } else if (result.newHighestBidderId === result.userId) {
      baseMessage = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND (Your max: ${result.bidAmount.toLocaleString()} VND)`;
    } else {
      baseMessage = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND`;
    }

    if (result.autoExtended) {
      const extendedTimeStr = new Date(result.newEndTime).toLocaleString(
        "vi-VN",
      );
      baseMessage += ` | Auction extended to ${extendedTimeStr}`;
    }

    req.session.success_message = baseMessage;
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error("Bid error:", error);
    req.session.error_message =
      error.message || "An error occurred while placing bid. Please try again.";
    res.redirect(`/products/detail?id=${productId}`);
  }
}

export async function postComment(req, res) {
  const { productId, content, parentId } = req.body;
  const userId = req.session.authUser.id;

  try {
    if (!content || content.trim().length === 0) {
      req.session.error_message = "Comment cannot be empty";
      return res.redirect(`/products/detail?id=${productId}`);
    }

    await productCommentModel.createComment(
      productId,
      userId,
      content.trim(),
      parentId || null,
    );

    const product = await productModel.findByProductId2(productId, null);
    const commenter = await userModel.findById(userId);
    const seller = await userModel.findById(product.seller_id);
    const productUrl = buildProductUrl(req, productId);
    const isSellerReplying = userId === product.seller_id;

    if (isSellerReplying && parentId) {
      const bidders = await biddingHistoryModel.getUniqueBidders(productId);
      const commenters =
        await productCommentModel.getUniqueCommenters(productId);

      const recipientsMap = new Map();
      bidders.forEach((b) => {
        if (b.id !== product.seller_id && b.email)
          recipientsMap.set(b.id, { email: b.email, fullname: b.fullname });
      });
      commenters.forEach((c) => {
        if (c.id !== product.seller_id && c.email)
          recipientsMap.set(c.id, { email: c.email, fullname: c.fullname });
      });

      for (const [, recipient] of recipientsMap) {
        try {
          await sendMail({
            to: recipient.email,
            subject: `Seller answered a question on: ${product.name}`,
            html: sellerReplyBroadcast({
              recipientName: recipient.fullname,
              productName: product.name,
              sellerName: seller.fullname,
              content,
              productUrl,
            }),
          });
        } catch (emailError) {
          console.error(
            `Failed to send email to ${recipient.email}:`,
            emailError,
          );
        }
      }
      console.log(
        `Seller reply notification sent to ${recipientsMap.size} recipients`,
      );
    } else if (seller && seller.email && userId !== product.seller_id) {
      if (parentId) {
        await sendMail({
          to: seller.email,
          subject: `New reply on your product: ${product.name}`,
          html: commentNotify({
            recipientName: seller.fullname,
            productName: product.name,
            fromName: commenter.fullname,
            content,
            isReply: true,
            productUrl,
          }),
        });
      } else {
        await sendMail({
          to: seller.email,
          subject: `New question about your product: ${product.name}`,
          html: commentNotify({
            recipientName: seller.fullname,
            productName: product.name,
            fromName: commenter.fullname,
            content,
            isReply: false,
            productUrl,
          }),
        });
      }
    }

    req.session.success_message = "Comment posted successfully!";
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error("Post comment error:", error);
    req.session.error_message = "Failed to post comment. Please try again.";
    res.redirect(`/products/detail?id=${productId}`);
  }
}

export async function getBidHistory(req, res) {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Get bid history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load bidding history" });
  }
}

export async function getCompleteOrder(req, res) {
  const userId = req.session.authUser.id;
  const productId = req.query.id;

  if (!productId) return res.redirect("/");

  const product = await productModel.findByProductId2(productId, userId);
  if (!product)
    return res.status(404).render("404", { message: "Product not found" });

  const now = new Date();
  const endDate = new Date(product.end_at);
  const productStatus = resolveProductStatus(product);

  if (productStatus !== "PENDING")
    return res.redirect(`/products/detail?id=${productId}`);

  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;

  if (!isSeller && !isHighestBidder) {
    return res.status(403).render("403", {
      message: "You do not have permission to access this page",
    });
  }

  let order = await orderModel.findByProductId(productId);

  if (!order) {
    await orderModel.createOrder({
      product_id: productId,
      buyer_id: product.highest_bidder_id,
      seller_id: product.seller_id,
      final_price: product.current_price || product.highest_bid || 0,
    });
    order = await orderModel.findByProductId(productId);
  }

  let paymentInvoice = await invoiceModel.getPaymentInvoice(order.id);
  let shippingInvoice = await invoiceModel.getShippingInvoice(order.id);

  if (paymentInvoice && paymentInvoice.payment_proof_urls) {
    paymentInvoice.payment_proof_urls = parsePgArray(
      paymentInvoice.payment_proof_urls,
    );
  }

  if (shippingInvoice && shippingInvoice.shipping_proof_urls) {
    shippingInvoice.shipping_proof_urls = parsePgArray(
      shippingInvoice.shipping_proof_urls,
    );
  }

  const messages = await orderChatModel.getMessagesByOrderId(order.id);

  res.render("vwProduct/complete-order", {
    product,
    order,
    paymentInvoice,
    shippingInvoice,
    messages,
    isSeller,
    isHighestBidder,
    currentUserId: userId,
  });
}

export async function uploadImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const urls = req.files.map((file) => `uploads/${file.filename}`);
    res.json({ success: true, urls });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
}

export async function submitPayment(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const {
      payment_method,
      payment_proof_urls,
      note,
      shipping_address,
      shipping_phone,
    } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order || order.buyer_id !== userId)
      return res.status(403).json({ error: "Unauthorized" });

    await invoiceModel.createPaymentInvoice({
      order_id: orderId,
      issuer_id: userId,
      payment_method,
      payment_proof_urls,
      note,
    });
    await orderModel.updateShippingInfo(orderId, {
      shipping_address,
      shipping_phone,
    });
    await orderModel.updateStatus(orderId, "payment_submitted", userId);

    res.json({ success: true, message: "Payment submitted successfully" });
  } catch (error) {
    console.error("Submit payment error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to submit payment" });
  }
}

export async function confirmPayment(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;

    const order = await orderModel.findById(orderId);
    if (!order || order.seller_id !== userId)
      return res.status(403).json({ error: "Unauthorized" });

    const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
    if (!paymentInvoice)
      return res.status(400).json({ error: "No payment invoice found" });

    await invoiceModel.verifyInvoice(paymentInvoice.id);
    await orderModel.updateStatus(orderId, "payment_confirmed", userId);

    res.json({ success: true, message: "Payment confirmed successfully" });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to confirm payment" });
  }
}

export async function submitShipping(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { tracking_number, shipping_provider, shipping_proof_urls, note } =
      req.body;

    const order = await orderModel.findById(orderId);
    if (!order || order.seller_id !== userId)
      return res.status(403).json({ error: "Unauthorized" });

    await invoiceModel.createShippingInvoice({
      order_id: orderId,
      issuer_id: userId,
      tracking_number,
      shipping_provider,
      shipping_proof_urls,
      note,
    });
    await orderModel.updateStatus(orderId, "shipped", userId);

    res.json({
      success: true,
      message: "Shipping info submitted successfully",
    });
  } catch (error) {
    console.error("Submit shipping error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to submit shipping" });
  }
}

export async function confirmDelivery(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;

    const order = await orderModel.findById(orderId);
    if (!order || order.buyer_id !== userId)
      return res.status(403).json({ error: "Unauthorized" });

    await orderModel.updateStatus(orderId, "delivered", userId);

    res.json({ success: true, message: "Delivery confirmed successfully" });
  } catch (error) {
    console.error("Confirm delivery error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to confirm delivery" });
  }
}

export async function submitRating(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { rating, comment } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const isBuyer = order.buyer_id === userId;
    const reviewerId = userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
    const ratingValue = rating === "positive" ? 1 : -1;

    const existingReview = await reviewModel.findByReviewerAndProduct(
      reviewerId,
      order.product_id,
    );

    if (existingReview) {
      await reviewModel.updateByReviewerAndProduct(
        reviewerId,
        order.product_id,
        { rating: ratingValue, comment: comment || null },
      );
    } else {
      await reviewModel.create({
        reviewer_id: reviewerId,
        reviewed_user_id: revieweeId,
        product_id: order.product_id,
        rating: ratingValue,
        comment: comment || null,
      });
    }

    const buyerReview = await reviewModel.getProductReview(
      order.buyer_id,
      order.seller_id,
      order.product_id,
    );
    const sellerReview = await reviewModel.getProductReview(
      order.seller_id,
      order.buyer_id,
      order.product_id,
    );

    if (buyerReview && sellerReview) {
      await orderModel.updateStatus(orderId, "completed", userId);
      await db("products")
        .where("id", order.product_id)
        .update({ is_sold: true, closed_at: new Date() });
    }

    res.json({ success: true, message: "Rating submitted successfully" });
  } catch (error) {
    console.error("Submit rating error:", error);
    res.status(500).json({ error: error.message || "Failed to submit rating" });
  }
}

export async function completeTransaction(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;

    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const isBuyer = order.buyer_id === userId;
    const reviewerId = userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

    const existingReview = await reviewModel.findByReviewerAndProduct(
      reviewerId,
      order.product_id,
    );

    if (!existingReview) {
      await reviewModel.create({
        reviewer_id: reviewerId,
        reviewed_user_id: revieweeId,
        product_id: order.product_id,
        rating: 0,
        comment: null,
      });
    }

    const buyerReview = await reviewModel.getProductReview(
      order.buyer_id,
      order.seller_id,
      order.product_id,
    );
    const sellerReview = await reviewModel.getProductReview(
      order.seller_id,
      order.buyer_id,
      order.product_id,
    );

    if (buyerReview && sellerReview) {
      await orderModel.updateStatus(orderId, "completed", userId);
      await db("products")
        .where("id", order.product_id)
        .update({ is_sold: true, closed_at: new Date() });
    }

    res.json({ success: true, message: "Transaction completed" });
  } catch (error) {
    console.error("Complete transaction error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to complete transaction" });
  }
}

export async function sendMessage(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { message } = req.body;

    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await orderChatModel.sendMessage({
      order_id: orderId,
      sender_id: userId,
      message,
    });

    res.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
}

export async function getMessages(req, res) {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;

    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const messages = await orderChatModel.getMessagesByOrderId(orderId);

    let messagesHtml = "";
    messages.forEach((msg) => {
      const isSent = msg.sender_id === userId;
      const messageClass = isSent ? "text-end" : "";
      const bubbleClass = isSent ? "sent" : "received";

      const msgDate = new Date(msg.created_at);
      const year = msgDate.getFullYear();
      const month = String(msgDate.getMonth() + 1).padStart(2, "0");
      const day = String(msgDate.getDate()).padStart(2, "0");
      const hour = String(msgDate.getHours()).padStart(2, "0");
      const minute = String(msgDate.getMinutes()).padStart(2, "0");
      const second = String(msgDate.getSeconds()).padStart(2, "0");
      const formattedDate = `${hour}:${minute}:${second} ${day}/${month}/${year}`;

      messagesHtml += `
        <div class="chat-message ${messageClass}">
          <div class="chat-bubble ${bubbleClass}">
            <div>${msg.message}</div>
            <div style="font-size: 0.7rem; margin-top: 3px; opacity: 0.8;">${formattedDate}</div>
          </div>
        </div>
      `;
    });

    res.json({ success: true, messagesHtml });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message || "Failed to get messages" });
  }
}

export async function rejectBidder(req, res) {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    let rejectedBidderInfo = null;
    let productInfo = null;
    let sellerInfo = null;

    await db.transaction(async (trx) => {
      const product = await trx("products")
        .where("id", productId)
        .forUpdate()
        .first();

      if (!product) throw new Error("Product not found");
      if (product.seller_id !== sellerId)
        throw new Error("Only the seller can reject bidders");

      const now = new Date();
      const endDate = new Date(product.end_at);

      if (product.is_sold !== null || endDate <= now || product.closed_at) {
        throw new Error("Can only reject bidders for active auctions");
      }

      const autoBid = await trx("auto_bidding")
        .where("product_id", productId)
        .where("bidder_id", bidderId)
        .first();
      if (!autoBid)
        throw new Error("This bidder has not placed a bid on this product");

      rejectedBidderInfo = await trx("users").where("id", bidderId).first();
      productInfo = product;
      sellerInfo = await trx("users").where("id", sellerId).first();

      await trx("rejected_bidders")
        .insert({
          product_id: productId,
          bidder_id: bidderId,
          seller_id: sellerId,
        })
        .onConflict(["product_id", "bidder_id"])
        .ignore();
      await trx("bidding_history")
        .where("product_id", productId)
        .where("bidder_id", bidderId)
        .del();
      await trx("auto_bidding")
        .where("product_id", productId)
        .where("bidder_id", bidderId)
        .del();

      const allAutoBids = await trx("auto_bidding")
        .where("product_id", productId)
        .orderBy("max_price", "desc");
      const bidderIdNum = parseInt(bidderId);
      const highestBidderIdNum = parseInt(product.highest_bidder_id);
      const wasHighestBidder = highestBidderIdNum === bidderIdNum;

      if (allAutoBids.length === 0) {
        await trx("products").where("id", productId).update({
          highest_bidder_id: null,
          current_price: product.starting_price,
          highest_max_price: null,
        });
      } else if (allAutoBids.length === 1) {
        const winner = allAutoBids[0];
        const newPrice = product.starting_price;
        await trx("products").where("id", productId).update({
          highest_bidder_id: winner.bidder_id,
          current_price: newPrice,
          highest_max_price: winner.max_price,
        });
        if (wasHighestBidder || product.current_price !== newPrice) {
          await trx("bidding_history").insert({
            product_id: productId,
            bidder_id: winner.bidder_id,
            current_price: newPrice,
          });
        }
      } else if (wasHighestBidder) {
        const firstBidder = allAutoBids[0];
        const secondBidder = allAutoBids[1];
        let newPrice = secondBidder.max_price + product.step_price;
        if (newPrice > firstBidder.max_price) newPrice = firstBidder.max_price;

        await trx("products").where("id", productId).update({
          highest_bidder_id: firstBidder.bidder_id,
          current_price: newPrice,
          highest_max_price: firstBidder.max_price,
        });

        const lastHistory = await trx("bidding_history")
          .where("product_id", productId)
          .orderBy("created_at", "desc")
          .first();
        if (!lastHistory || lastHistory.current_price !== newPrice) {
          await trx("bidding_history").insert({
            product_id: productId,
            bidder_id: firstBidder.bidder_id,
            current_price: newPrice,
          });
        }
      }
    });

    if (rejectedBidderInfo && rejectedBidderInfo.email && productInfo) {
      sendMail({
        to: rejectedBidderInfo.email,
        subject: `Your bid has been rejected: ${productInfo.name}`,
        html: bidRejectedNotify({
          bidderName: rejectedBidderInfo.fullname,
          productName: productInfo.name,
          sellerName: sellerInfo ? sellerInfo.fullname : "N/A",
          browseUrl: `${req.protocol}://${req.get("host")}/`,
        }),
      })
        .then(() => {
          console.log(
            `Rejection email sent to ${rejectedBidderInfo.email} for product #${productId}`,
          );
        })
        .catch((emailError) => {
          console.error("Failed to send rejection email:", emailError);
        });
    }

    res.json({ success: true, message: "Bidder rejected successfully" });
  } catch (error) {
    console.error("Error rejecting bidder:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to reject bidder",
    });
  }
}

export async function unrejectBidder(req, res) {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    const product = await productModel.findByProductId2(productId, sellerId);
    if (!product) throw new Error("Product not found");
    if (product.seller_id !== sellerId)
      throw new Error("Only the seller can unreject bidders");

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error("Can only unreject bidders for active auctions");
    }

    await rejectedBidderModel.unrejectBidder(productId, bidderId);

    res.json({
      success: true,
      message: "Bidder can now bid on this product again",
    });
  } catch (error) {
    console.error("Error unrejecting bidder:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to unreject bidder",
    });
  }
}

export async function buyNow(req, res) {
  const { productId } = req.body;
  const userId = req.session.authUser.id;

  try {
    await db.transaction(async (trx) => {
      const product = await trx("products")
        .leftJoin("users as seller", "products.seller_id", "seller.id")
        .where("products.id", productId)
        .select("products.*", "seller.fullname as seller_name")
        .first();

      if (!product) throw new Error("Product not found");
      if (product.seller_id === userId)
        throw new Error("Seller cannot buy their own product");

      const now = new Date();
      const endDate = new Date(product.end_at);

      if (product.is_sold !== null)
        throw new Error("Product is no longer available");
      if (endDate <= now || product.closed_at)
        throw new Error("Auction has already ended");
      if (!product.buy_now_price)
        throw new Error("Buy Now option is not available for this product");

      const buyNowPrice = parseFloat(product.buy_now_price);

      const isRejected = await trx("rejected_bidders")
        .where({ product_id: productId, bidder_id: userId })
        .first();
      if (isRejected)
        throw new Error("You have been rejected from bidding on this product");

      if (!product.allow_unrated_bidder) {
        const ratingData = await reviewModel.calculateRatingPoint(userId);
        const ratingPoint = ratingData ? ratingData.rating_point : 0;
        if (ratingPoint === 0)
          throw new Error(
            "This product does not allow bidders without ratings",
          );
      }

      await trx("products").where("id", productId).update({
        current_price: buyNowPrice,
        highest_bidder_id: userId,
        highest_max_price: buyNowPrice,
        end_at: now,
        closed_at: now,
        is_buy_now_purchase: true,
      });

      await trx("bidding_history").insert({
        product_id: productId,
        bidder_id: userId,
        current_price: buyNowPrice,
        is_buy_now: true,
      });
    });

    res.json({
      success: true,
      message:
        "Congratulations! You have successfully purchased the product at Buy Now price. Please proceed to payment.",
      redirectUrl: `/products/complete-order?id=${productId}`,
    });
  } catch (error) {
    console.error("Buy Now error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to purchase product",
    });
  }
}

export async function getSellerRatings(req, res) {
  try {
    const sellerId = parseInt(req.params.sellerId);
    if (!sellerId) return res.redirect("/");

    const seller = await userModel.findById(sellerId);
    if (!seller) return res.redirect("/");

    const { rating_point, reviews } = await getUserRatingInfo(sellerId);
    const totalReviews = reviews.length;
    const positiveReviews = reviews.filter((r) => r.rating === 1).length;
    const negativeReviews = reviews.filter((r) => r.rating === -1).length;

    res.render("vwProduct/seller-ratings", {
      sellerName: seller.fullname,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews,
    });
  } catch (error) {
    console.error("Error loading seller ratings page:", error);
    res.redirect("/");
  }
}

export async function getBidderRatings(req, res) {
  try {
    const bidderId = parseInt(req.params.bidderId);
    if (!bidderId) return res.redirect("/");

    const bidder = await userModel.findById(bidderId);
    if (!bidder) return res.redirect("/");

    const { rating_point, reviews } = await getUserRatingInfo(bidderId);
    const totalReviews = reviews.length;
    const positiveReviews = reviews.filter((r) => r.rating === 1).length;
    const negativeReviews = reviews.filter((r) => r.rating === -1).length;

    const maskedName = bidder.fullname
      ? bidder.fullname
          .split("")
          .map((char, index) => (index % 2 === 0 ? char : "*"))
          .join("")
      : "";

    res.render("vwProduct/bidder-ratings", {
      bidderName: maskedName,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews,
    });
  } catch (error) {
    console.error("Error loading bidder ratings page:", error);
    res.redirect("/");
  }
}
