/**
 * Auction End Notifier
 * Script kiểm tra và gửi email thông báo khi đấu giá kết thúc
 */

import * as productModel from "../models/product.model.js";
import { sendMail } from "../utils/mailer.js";
import {
  auctionWonNotify,
  auctionEndSellerWithWinner,
  auctionEndNoBidders,
} from "../helpers/emailTemplates.helper.js";

/**
 * Kiểm tra các đấu giá kết thúc và gửi email thông báo
 */
export async function checkAndNotifyEndedAuctions() {
  try {
    const endedAuctions = await productModel.getNewlyEndedAuctions();

    if (endedAuctions.length === 0) {
      return;
    }

    console.log(`📧 Found ${endedAuctions.length} ended auctions to notify`);

    for (const auction of endedAuctions) {
      try {
        const productUrl = `${process.env.BASE_URL || "http://localhost:3005"}/products/detail?id=${auction.id}`;

        // Có người thắng
        if (auction.highest_bidder_id) {
          // Gửi email cho người thắng
          if (auction.winner_email) {
            await sendMail({
              to: auction.winner_email,
              subject: `🎉 Congratulations! You won the auction: ${auction.name}`,
              html: auctionWonNotify({
                winnerName: auction.winner_name,
                productName: auction.name,
                price: auction.current_price,
                productUrl,
              }),
            });
            console.log(
              `✅ Winner notification sent to ${auction.winner_email} for product #${auction.id}`,
            );
          }

          // Gửi email cho người bán - Có người thắng
          if (auction.seller_email) {
            await sendMail({
              to: auction.seller_email,
              subject: `🔔 Auction Ended: ${auction.name} - Winner Found!`,
              html: auctionEndSellerWithWinner({
                sellerName: auction.seller_name,
                productName: auction.name,
                winnerName: auction.winner_name,
                price: auction.current_price,
                productUrl,
              }),
            });
            console.log(
              `✅ Seller notification sent to ${auction.seller_email} for product #${auction.id}`,
            );
          }
        } else {
          // Không có người thắng - Chỉ thông báo cho người bán
          if (auction.seller_email) {
            await sendMail({
              to: auction.seller_email,
              subject: `⏰ Auction Ended: ${auction.name} - No Bidders`,
              html: auctionEndNoBidders({
                sellerName: auction.seller_name,
                productName: auction.name,
                newAuctionUrl: `${process.env.BASE_URL || "http://localhost:3005"}/seller/add`,
              }),
            });
            console.log(
              `✅ Seller notification (no bidders) sent to ${auction.seller_email} for product #${auction.id}`,
            );
          }
        }

        // Đánh dấu đã gửi thông báo
        await productModel.markEndNotificationSent(auction.id);
      } catch (emailError) {
        console.error(
          `❌ Failed to send notification for product #${auction.id}:`,
          emailError,
        );
      }
    }
  } catch (error) {
    console.error("❌ Error checking ended auctions:", error);
  }
}

/**
 * Khởi chạy job định kỳ
 * @param {number} intervalSeconds - Khoảng thời gian giữa các lần kiểm tra (giây)
 */
export function startAuctionEndNotifier(intervalSeconds = 30) {
  console.log(
    `🚀 Auction End Notifier started (checking every ${intervalSeconds} second(s))`,
  );

  // Chạy ngay lần đầu
  checkAndNotifyEndedAuctions();

  // Sau đó chạy định kỳ
  setInterval(checkAndNotifyEndedAuctions, intervalSeconds * 1000);
}
