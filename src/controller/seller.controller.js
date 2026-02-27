import * as productModel from "../models/product.model.js";
import * as reviewModel from "../models/review.model.js";
import * as productDescUpdateModel from "../models/productDescriptionUpdate.model.js";
import * as biddingHistoryModel from "../models/biddingHistory.model.js";
import * as productCommentModel from "../models/productComment.model.js";
import { sendMail } from "../utils/mailer.js";
import { descriptionUpdateNotify } from "../helpers/emailTemplates.helper.js";
import fs from "fs";
import { upload } from "../helpers/upload.helper.js";
export { upload };

// ===================== CONTROLLERS =====================

export async function getDashboard(req, res) {
  const sellerId = req.session.authUser.id;
  const stats = await productModel.getSellerStats(sellerId);
  res.render("vwSeller/dashboard", { stats });
}

export async function getAllProducts(req, res) {
  const sellerId = req.session.authUser.id;
  const products = await productModel.findAllProductsBySellerId(sellerId);
  res.render("vwSeller/all-products", { products });
}

export async function getActiveProducts(req, res) {
  const sellerId = req.session.authUser.id;
  const products = await productModel.findActiveProductsBySellerId(sellerId);
  res.render("vwSeller/active", { products });
}

export async function getPendingProducts(req, res) {
  const sellerId = req.session.authUser.id;
  const [products, stats] = await Promise.all([
    productModel.findPendingProductsBySellerId(sellerId),
    productModel.getPendingProductsStats(sellerId),
  ]);

  let success_message = "";
  if (req.query.message === "cancelled") {
    success_message = "Auction cancelled successfully!";
  }

  res.render("vwSeller/pending", { products, stats, success_message });
}

export async function getSoldProducts(req, res) {
  const sellerId = req.session.authUser.id;
  const [products, stats] = await Promise.all([
    productModel.findSoldProductsBySellerId(sellerId),
    productModel.getSoldProductsStats(sellerId),
  ]);

  const productsWithReview = await Promise.all(
    products.map(async (product) => {
      const review = await reviewModel.getProductReview(
        sellerId,
        product.highest_bidder_id,
        product.id,
      );
      const hasActualReview = review && review.rating !== 0;
      return {
        ...product,
        hasReview: hasActualReview,
        reviewRating: hasActualReview
          ? review.rating === 1
            ? "positive"
            : "negative"
          : null,
        reviewComment: hasActualReview ? review.comment : "",
      };
    }),
  );

  res.render("vwSeller/sold-products", {
    products: productsWithReview,
    stats,
  });
}

export async function getExpiredProducts(req, res) {
  const sellerId = req.session.authUser.id;
  const products = await productModel.findExpiredProductsBySellerId(sellerId);

  for (const product of products) {
    if (product.status === "Cancelled" && product.highest_bidder_id) {
      const review = await reviewModel.getProductReview(
        sellerId,
        product.highest_bidder_id,
        product.id,
      );
      const hasActualReview = review && review.rating !== 0;
      product.hasReview = hasActualReview;
      if (hasActualReview) {
        product.reviewRating = review.rating === 1 ? "positive" : "negative";
        product.reviewComment = review.comment;
      }
    }
  }

  res.render("vwSeller/expired", { products });
}

export async function getAddProduct(req, res) {
  const success_message = req.session.success_message;
  delete req.session.success_message;
  res.render("vwSeller/add", { success_message });
}

export async function postAddProduct(req, res) {
  const product = req.body;
  const sellerId = req.session.authUser.id;

  const createdAtUTC = new Date(product.created_at);
  const endAtUTC = new Date(product.end_date);

  const productData = {
    seller_id: sellerId,
    category_id: product.category_id,
    name: product.name,
    starting_price: product.start_price.replace(/,/g, ""),
    step_price: product.step_price.replace(/,/g, ""),
    buy_now_price:
      product.buy_now_price !== ""
        ? product.buy_now_price.replace(/,/g, "")
        : null,
    created_at: createdAtUTC,
    end_at: endAtUTC,
    auto_extend: product.auto_extend === "1",
    thumbnail: null,
    description: product.description,
    highest_bidder_id: null,
    current_price: product.start_price.replace(/,/g, ""),
    is_sold: null,
    allow_unrated_bidder: product.allow_new_bidders === "1",
    closed_at: null,
  };

  const returnedID = await productModel.addProduct(productData);

  const dirPath = path.join("public", "images", "products").replace(/\\/g, "/");
  const imgs = JSON.parse(product.imgs_list);

  // Move and rename thumbnail
  const mainPath = path
    .join(dirPath, `p${returnedID[0].id}_thumb.jpg`)
    .replace(/\\/g, "/");
  const oldMainPath = path
    .join("public", "uploads", path.basename(product.thumbnail))
    .replace(/\\/g, "/");
  const savedMainPath =
    "/" +
    path
      .join("images", "products", `p${returnedID[0].id}_thumb.jpg`)
      .replace(/\\/g, "/");
  fs.renameSync(oldMainPath, mainPath);
  await productModel.updateProductThumbnail(returnedID[0].id, savedMainPath);

  // Move and rename subimages
  let i = 1;
  const newImgPaths = [];
  for (const imgPath of imgs) {
    const oldPath = path
      .join("public", "uploads", path.basename(imgPath))
      .replace(/\\/g, "/");
    const newPath = path
      .join(dirPath, `p${returnedID[0].id}_${i}.jpg`)
      .replace(/\\/g, "/");
    const savedPath =
      "/" +
      path
        .join("images", "products", `p${returnedID[0].id}_${i}.jpg`)
        .replace(/\\/g, "/");
    fs.renameSync(oldPath, newPath);
    newImgPaths.push({ product_id: returnedID[0].id, img_link: savedPath });
    i++;
  }

  await productModel.addProductImages(newImgPaths);

  req.session.success_message = "Product added successfully!";
  res.redirect("/seller/products/add");
}

export async function uploadThumbnail(req, res) {
  res.json({ success: true, file: req.file });
}

export async function uploadSubimages(req, res) {
  res.json({ success: true, files: req.files });
}

export async function cancelProduct(req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    const { reason, highest_bidder_id } = req.body;

    await productModel.cancelProduct(productId, sellerId);

    if (highest_bidder_id) {
      const reviewModule = await import("../models/review.model.js");
      await reviewModule.createReview({
        reviewer_id: sellerId,
        reviewee_id: highest_bidder_id,
        product_id: productId,
        rating: -1,
        comment: reason || "Auction cancelled by seller",
      });
    }

    res.json({ success: true, message: "Auction cancelled successfully" });
  } catch (error) {
    console.error("Cancel product error:", error);
    if (error.message === "Product not found")
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    if (error.message === "Unauthorized")
      return res.status(403).json({ success: false, message: "Unauthorized" });
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function rateBidder(req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    const { rating, comment, highest_bidder_id } = req.body;

    if (!highest_bidder_id)
      return res
        .status(400)
        .json({ success: false, message: "No bidder to rate" });

    const ratingValue = rating === "positive" ? 1 : -1;
    const existingReview = await reviewModel.findByReviewerAndProduct(
      sellerId,
      productId,
    );

    if (existingReview) {
      await reviewModel.updateByReviewerAndProduct(sellerId, productId, {
        rating: ratingValue,
        comment: comment || null,
      });
    } else {
      await reviewModel.createReview({
        reviewer_id: sellerId,
        reviewee_id: highest_bidder_id,
        product_id: productId,
        rating: ratingValue,
        comment: comment || "",
      });
    }

    res.json({ success: true, message: "Rating submitted successfully" });
  } catch (error) {
    console.error("Rate bidder error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateBidderRating(req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    const { rating, comment, highest_bidder_id } = req.body;

    if (!highest_bidder_id)
      return res
        .status(400)
        .json({ success: false, message: "No bidder to rate" });

    const ratingValue = rating === "positive" ? 1 : -1;
    await reviewModel.updateReview(sellerId, highest_bidder_id, productId, {
      rating: ratingValue,
      comment: comment || "",
    });

    res.json({ success: true, message: "Rating updated successfully" });
  } catch (error) {
    console.error("Update rating error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function appendDescription(req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;
    const { description } = req.body;

    if (!description || description.trim() === "")
      return res
        .status(400)
        .json({ success: false, message: "Description is required" });

    const product = await productModel.findByProductId2(productId, null);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    if (product.seller_id !== sellerId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    await productDescUpdateModel.addUpdate(productId, description.trim());

    const [bidders, commenters] = await Promise.all([
      biddingHistoryModel.getUniqueBidders(productId),
      productCommentModel.getUniqueCommenters(productId),
    ]);

    const notifyMap = new Map();
    [...bidders, ...commenters].forEach((user) => {
      if (user.id !== sellerId && !notifyMap.has(user.email)) {
        notifyMap.set(user.email, user);
      }
    });

    const notifyUsers = Array.from(notifyMap.values());
    if (notifyUsers.length > 0) {
      const productUrl = `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;

      Promise.all(
        notifyUsers.map((user) =>
          sendMail({
            to: user.email,
            subject: `[Auction Update] New description added for "${product.name}"`,
            html: descriptionUpdateNotify({
              recipientName: user.fullname,
              productName: product.name,
              currentPrice: product.current_price,
              description: description.trim(),
              productUrl,
            }),
          }).catch((err) =>
            console.error("Failed to send email to", user.email, err),
          ),
        ),
      ).catch((err) => console.error("Email notification error:", err));
    }

    res.json({ success: true, message: "Description appended successfully" });
  } catch (error) {
    console.error("Append description error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getDescriptionUpdates(req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;

    const product = await productModel.findByProductId2(productId, null);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    if (product.seller_id !== sellerId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    const updates = await productDescUpdateModel.findByProductId(productId);
    res.json({ success: true, updates });
  } catch (error) {
    console.error("Get description updates error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateDescriptionUpdate(req, res) {
  try {
    const updateId = req.params.updateId;
    const sellerId = req.session.authUser.id;
    const { content } = req.body;

    if (!content || content.trim() === "")
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });

    const update = await productDescUpdateModel.findById(updateId);
    if (!update)
      return res
        .status(404)
        .json({ success: false, message: "Update not found" });

    const product = await productModel.findByProductId2(
      update.product_id,
      null,
    );
    if (!product || product.seller_id !== sellerId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    await productDescUpdateModel.updateContent(updateId, content.trim());
    res.json({ success: true, message: "Update saved successfully" });
  } catch (error) {
    console.error("Update description error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteDescriptionUpdate(req, res) {
  try {
    const updateId = req.params.updateId;
    const sellerId = req.session.authUser.id;

    const update = await productDescUpdateModel.findById(updateId);
    if (!update)
      return res
        .status(404)
        .json({ success: false, message: "Update not found" });

    const product = await productModel.findByProductId2(
      update.product_id,
      null,
    );
    if (!product || product.seller_id !== sellerId)
      return res.status(403).json({ success: false, message: "Unauthorized" });

    await productDescUpdateModel.deleteUpdate(updateId);
    res.json({ success: true, message: "Update deleted successfully" });
  } catch (error) {
    console.error("Delete description error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}
