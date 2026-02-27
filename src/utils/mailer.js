// utils/mailer.js
import transporter from "../config/mailer.config.js";
import dotenv from "dotenv";

dotenv.config();

export async function sendMail({ to, subject, html }) {
  console.log("➡️ Sending mail to:", to);
  return transporter.sendMail({
    from: `"Online Auction" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

export { transporter };
