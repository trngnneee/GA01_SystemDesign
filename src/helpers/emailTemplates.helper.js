/**
 * Email Template Builder
 * DRY: Extracts repeated email HTML patterns into reusable functions.
 */

import { format_number } from "./math.helper.js";

// ============================================================
// Base layout wrapper (shared by ALL emails)
// ============================================================
function baseLayout(headerBg, headerText, bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${headerBg}); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${headerText}</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        ${bodyHtml}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
    </div>
  `;
}

function productCard(borderColor, innerHtml) {
  return `
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${borderColor};">
      ${innerHtml}
    </div>
  `;
}

function ctaButton(url, bgGradient, text) {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, ${bgGradient}); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ${text}
      </a>
    </div>
  `;
}

function infoBox(bgColor, textColor, html) {
  return `
    <div style="background-color: ${bgColor}; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0; color: ${textColor};">${html}</p>
    </div>
  `;
}

// ============================================================
// Specific email templates
// ============================================================

export function bidNotifySeller({
  sellerName,
  productName,
  bidderName,
  newPrice,
  previousPrice,
  productSold,
  productUrl,
}) {
  const body = `
    <p>Dear <strong>${sellerName}</strong>,</p>
    <p>Great news! Your product has received a new bid:</p>
    ${productCard(
      "#72AEC8",
      `
      <h3 style="margin: 0 0 15px 0; color: #333;">${productName}</h3>
      <p style="margin: 5px 0;"><strong>Bidder:</strong> ${bidderName || "Anonymous"}</p>
      <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
      <p style="font-size: 28px; color: #72AEC8; margin: 5px 0; font-weight: bold;">${format_number(newPrice)} VND</p>
      ${previousPrice !== newPrice ? `<p style="margin: 5px 0; color: #666; font-size: 14px;"><i>Previous: ${format_number(previousPrice)} VND</i></p>` : ""}
    `,
    )}
    ${productSold ? infoBox("#d4edda", "#155724", "<strong>🎉 Buy Now price reached!</strong> Auction has ended.") : ""}
    ${ctaButton(productUrl, "#72AEC8 0%, #5a9ab8 100%", "View Product")}
  `;
  return baseLayout("#72AEC8 0%, #5a9ab8 100%", "New Bid Received!", body);
}

export function bidNotifyBidder({
  bidderName,
  productName,
  isWinning,
  bidAmount,
  newPrice,
  productSold,
  productUrl,
}) {
  const color = isWinning ? "#28a745" : "#ffc107";
  const headerText = isWinning ? "You're Winning!" : "Bid Placed";
  const body = `
    <p>Dear <strong>${bidderName}</strong>,</p>
    <p>${isWinning ? "Congratulations! Your bid has been placed and you are currently the highest bidder!" : "Your bid has been placed. However, another bidder has a higher maximum bid."}</p>
    ${productCard(
      color,
      `
      <h3 style="margin: 0 0 15px 0; color: #333;">${productName}</h3>
      <p style="margin: 5px 0;"><strong>Your Max Bid:</strong> ${format_number(bidAmount)} VND</p>
      <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
      <p style="font-size: 28px; color: ${color}; margin: 5px 0; font-weight: bold;">${format_number(newPrice)} VND</p>
    `,
    )}
    ${productSold && isWinning ? infoBox("#d4edda", "#155724", "<strong>🎉 Congratulations! You won this product!</strong><br/>Please proceed to complete your payment.") : ""}
    ${!isWinning ? infoBox("#fff3cd", "#856404", "<strong>💡 Tip:</strong> Consider increasing your maximum bid to improve your chances of winning.") : ""}
    ${ctaButton(productUrl, "#72AEC8 0%, #5a9ab8 100%", productSold && isWinning ? "Complete Payment" : "View Auction")}
  `;
  return baseLayout(
    `${color} 0%, ${isWinning ? "#218838" : "#e0a800"} 100%`,
    headerText,
    body,
  );
}

export function bidNotifyOutbid({
  bidderName,
  productName,
  wasOutbid,
  newPrice,
  previousPrice,
  productUrl,
}) {
  const color = wasOutbid ? "#dc3545" : "#ffc107";
  const headerText = wasOutbid ? "You've Been Outbid!" : "Price Updated";
  const body = `
    <p>Dear <strong>${bidderName}</strong>,</p>
    ${
      wasOutbid
        ? "<p>Unfortunately, another bidder has placed a higher bid on the product you were winning:</p>"
        : "<p>Good news! You're still the highest bidder, but the current price has been updated due to a new bid:</p>"
    }
    ${productCard(
      color,
      `
      <h3 style="margin: 0 0 15px 0; color: #333;">${productName}</h3>
      ${!wasOutbid ? '<p style="margin: 5px 0; color: #28a745;"><strong>✓ You\'re still winning!</strong></p>' : ""}
      <p style="margin: 5px 0;"><strong>New Current Price:</strong></p>
      <p style="font-size: 28px; color: ${color}; margin: 5px 0; font-weight: bold;">${format_number(newPrice)} VND</p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;"><i>Previous price: ${format_number(previousPrice)} VND</i></p>
    `,
    )}
    ${
      wasOutbid
        ? infoBox(
            "#fff3cd",
            "#856404",
            "<strong>💡 Don't miss out!</strong> Place a new bid to regain the lead.",
          )
        : infoBox(
            "#d4edda",
            "#155724",
            "<strong>💡 Tip:</strong> Your automatic bidding is working! Consider increasing your max bid if you want more protection.",
          )
    }
    ${ctaButton(productUrl, wasOutbid ? "#28a745 0%, #218838 100%" : "#72AEC8 0%, #5a9ab8 100%", wasOutbid ? "Place New Bid" : "View Auction")}
  `;
  return baseLayout(
    `${color} 0%, ${wasOutbid ? "#c82333" : "#e0a800"} 100%`,
    headerText,
    body,
  );
}

export function auctionWonNotify({
  winnerName,
  productName,
  price,
  productUrl,
}) {
  const body = `
    <p>Dear <strong>${winnerName}</strong>,</p>
    <p>Congratulations! You have won the auction for:</p>
    ${productCard(
      "#28a745",
      `
      <h3 style="margin: 0 0 10px 0; color: #333;">${productName}</h3>
      <p style="font-size: 24px; color: #28a745; margin: 0; font-weight: bold;">${format_number(price)} VND</p>
    `,
    )}
    <p>Please complete your payment to finalize the purchase.</p>
    ${ctaButton(productUrl, "#28a745 0%, #218838 100%", "Complete Payment")}
    <p style="color: #666; font-size: 14px;">Please complete payment within 3 days to avoid order cancellation.</p>
  `;
  return baseLayout("#667eea 0%, #764ba2 100%", "🎉 You Won!", body);
}

export function auctionEndSellerWithWinner({
  sellerName,
  productName,
  winnerName,
  price,
  productUrl,
}) {
  const body = `
    <p>Dear <strong>${sellerName}</strong>,</p>
    <p>Your auction has ended with a winner!</p>
    ${productCard(
      "#72AEC8",
      `
      <h3 style="margin: 0 0 10px 0; color: #333;">${productName}</h3>
      <p style="margin: 5px 0;"><strong>Winner:</strong> ${winnerName}</p>
      <p style="font-size: 24px; color: #72AEC8; margin: 10px 0 0 0; font-weight: bold;">${format_number(price)} VND</p>
    `,
    )}
    <p>The winner has been notified to complete payment. You will receive another notification once payment is confirmed.</p>
    ${ctaButton(productUrl, "#72AEC8 0%, #5a9ab8 100%", "View Product")}
  `;
  return baseLayout("#72AEC8 0%, #5a9ab8 100%", "Auction Ended", body);
}

export function auctionEndNoBidders({
  sellerName,
  productName,
  newAuctionUrl,
}) {
  const body = `
    <p>Dear <strong>${sellerName}</strong>,</p>
    <p>Unfortunately, your auction has ended without any bidders.</p>
    ${productCard(
      "#6c757d",
      `
      <h3 style="margin: 0 0 10px 0; color: #333;">${productName}</h3>
      <p style="color: #6c757d; margin: 0;">No bids received</p>
    `,
    )}
    <p>You can relist this product or create a new auction with adjusted pricing.</p>
    ${ctaButton(newAuctionUrl, "#72AEC8 0%, #5a9ab8 100%", "Create New Auction")}
  `;
  return baseLayout("#6c757d 0%, #495057 100%", "Auction Ended", body);
}

export function bidRejectedNotify({
  bidderName,
  productName,
  sellerName,
  browseUrl,
}) {
  const body = `
    <p>Dear <strong>${bidderName}</strong>,</p>
    <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
    ${productCard(
      "#dc3545",
      `
      <h3 style="margin: 0 0 10px 0; color: #333;">${productName}</h3>
      <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${sellerName}</p>
    `,
    )}
    <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
    <p style="color: #666;">You can still participate in other auctions on our platform.</p>
    ${ctaButton(browseUrl, "#72AEC8 0%, #5a9ab8 100%", "Browse Other Auctions")}
    <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
  `;
  return baseLayout("#dc3545 0%, #c82333 100%", "Bid Rejected", body);
}

export function commentNotify({
  recipientName,
  productName,
  fromName,
  content,
  isReply,
  productUrl,
}) {
  const title = isReply
    ? "New Reply on Your Product"
    : "New Question About Your Product";
  const contentLabel = isReply ? "Reply" : "Question";
  const buttonText = isReply ? "View Product & Reply" : "View Product & Answer";
  const body = `
    <p>Dear <strong>${recipientName}</strong>,</p>
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p><strong>Product:</strong> ${productName}</p>
      <p><strong>From:</strong> ${fromName}</p>
      <p><strong>${contentLabel}:</strong></p>
      <p style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">${content}</p>
    </div>
    ${ctaButton(productUrl, "#667eea 0%, #667eea 100%", buttonText)}
  `;
  return baseLayout("#667eea 0%, #667eea 100%", title, body);
}

export function sellerReplyBroadcast({
  recipientName,
  productName,
  sellerName,
  content,
  productUrl,
}) {
  const body = `
    <p>Dear <strong>${recipientName}</strong>,</p>
    <p>The seller has responded to a question on a product you're interested in:</p>
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p><strong>Product:</strong> ${productName}</p>
      <p><strong>Seller:</strong> ${sellerName}</p>
      <p><strong>Answer:</strong></p>
      <p style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">${content}</p>
    </div>
    ${ctaButton(productUrl, "#667eea 0%, #667eea 100%", "View Product")}
  `;
  return baseLayout(
    "#667eea 0%, #667eea 100%",
    "Seller Response on Product",
    body,
  );
}

export function passwordResetNotify({ userName, newPassword }) {
  const body = `
    <p>Dear <strong>${userName}</strong>,</p>
    <p>Your account password has been reset by an administrator.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Your new temporary password:</strong></p>
      <p style="font-size: 24px; color: #e74c3c; margin: 10px 0; font-weight: bold;">${newPassword}</p>
    </div>
    <p style="color: #e74c3c;"><strong>Important:</strong> Please log in and change your password immediately for security purposes.</p>
    <p>If you did not request this password reset, please contact our support team immediately.</p>
  `;
  return baseLayout("#333 0%, #555 100%", "Password Reset Notification", body);
}

export function descriptionUpdateNotify({
  recipientName,
  productName,
  currentPrice,
  description,
  productUrl,
}) {
  const body = `
    <p>Hello <strong>${recipientName}</strong>,</p>
    <p>The seller has added new information to the product description:</p>
    <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${productName}</h3>
      <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${format_number(currentPrice)} VND</strong></p>
    </div>
    <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
      <div style="color: #333;">${description}</div>
    </div>
    ${ctaButton(productUrl, "#72AEC8 0%, #72AEC8 100%", "View Product")}
    <p style="color: #999; font-size: 12px;">You received this email because you placed a bid or asked a question on this product.</p>
  `;
  return baseLayout(
    "#72AEC8 0%, #5a9bb8 100%",
    "Product Description Updated",
    body,
  );
}
