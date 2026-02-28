# Báo cáo vi phạm DRY (Don't Repeat Yourself)

## 1. HTML email viết thẳng vào code, chưa tách thành template

Các khối HTML email dài 30–80 dòng được viết inline bằng template literal, trộn lẫn với business logic. Khi cần thay đổi styling (đổi màu brand, thêm footer, …) phải sửa từng file route/script.

**Nên tách sang:** `src/helpers/emailTemplates.helper.js`

### 1a. `src/scripts/auctionEndNotifier.js`

| Vị trí (dòng) | Nội dung inline                                      | Template nên tạo               |
| ------------- | ---------------------------------------------------- | ------------------------------ |
| ~L30–58       | HTML thông báo người thắng, dùng `Intl.NumberFormat` | `auctionWonNotify()`           |
| ~L65–95       | HTML thông báo người bán — có người thắng            | `auctionEndSellerWithWinner()` |
| ~L100–125     | HTML thông báo người bán — không có người đặt        | `auctionEndNoBidders()`        |

**Cách sửa:** Import template và thay thế các khối HTML inline.

```js
// TRƯỚC — HTML thô inline (src/scripts/auctionEndNotifier.js ~L30)
await sendMail({
  to: auction.winner_email,
  subject: `🎉 Congratulations! You won the auction: ${auction.name}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; ...">
      ...${new Intl.NumberFormat("en-US").format(auction.current_price)} VND...
    </div>
  `,
});

// SAU — dùng template
import {
  auctionWonNotify,
  auctionEndSellerWithWinner,
  auctionEndNoBidders,
} from "../helpers/emailTemplates.helper.js";

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
```

---

### 1b. `src/routes/admin/user.route.js`

| Vị trí (dòng) | Nội dung inline                      | Template nên tạo        |
| ------------- | ------------------------------------ | ----------------------- |
| ~L110–132     | HTML email đặt lại mật khẩu cho user | `passwordResetNotify()` |

**Cách sửa:**

```js
// TRƯỚC — HTML thô inline (src/routes/admin/user.route.js ~L110)
await sendMail({
  to: user.email,
  subject: "Your Password Has Been Reset - Online Auction",
  html: `<div style="font-family: Arial, ...">
    <h2>Password Reset Notification</h2>
    <p>Dear <strong>${user.fullname}</strong>,</p>
    ...${defaultPassword}...
  </div>`,
});

// SAU — dùng template
import { passwordResetNotify } from "../../helpers/emailTemplates.helper.js";

await sendMail({
  to: user.email,
  subject: "Your Password Has Been Reset - Online Auction",
  html: passwordResetNotify({
    userName: user.fullname,
    newPassword: defaultPassword,
  }),
});
```

### 1c. `src/routes/product.route.js` và `src/routes/seller.route.js`

| File                          | Vị trí (dòng) | Nội dung inline                                 |
| ----------------------------- | ------------- | ----------------------------------------------- |
| `src/routes/product.route.js` | ~L601–740     | Nhiều khối HTML (bid notification, outbid, ...) |
| `src/routes/seller.route.js`  | ~L349–370     | HTML thông báo cập nhật mô tả sản phẩm          |

---

## 2. Logic xác định `productStatus` bị lặp

Chuỗi `if/else` giống hệt nhau để suy ra `"SOLD" | "CANCELLED" | "PENDING" | "EXPIRED" | "ACTIVE"` từ `product.is_sold`, `product.closed_at`, `end_at` xuất hiện ở **2 chỗ** trong cùng file:

| #   | File                          | Dòng     | Ngữ cảnh                    |
| --- | ----------------------------- | -------- | --------------------------- |
| 1   | `src/routes/product.route.js` | L153–171 | `GET /detail` route         |
| 2   | `src/routes/product.route.js` | L985–994 | `GET /complete-order` route |

**Code lặp:**

```js
// Lặp giống nhau ở 2 chỗ (dòng 153 và dòng 985)
const now = new Date();
const endDate = new Date(product.end_at);
let productStatus = "ACTIVE";
if (product.is_sold === true) {
  productStatus = "SOLD";
} else if (product.is_sold === false) {
  productStatus = "CANCELLED";
} else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
  productStatus = "PENDING";
} else if (endDate <= now && !product.highest_bidder_id) {
  productStatus = "EXPIRED";
}
```

**Cách sửa:** Tách ra `src/helpers/product.helper.js`:

```js
export function resolveProductStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);
  if (product.is_sold === true) return "SOLD";
  if (product.is_sold === false) return "CANCELLED";
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
    return "PENDING";
  if (endDate <= now && !product.highest_bidder_id) return "EXPIRED";
  return "ACTIVE";
}
```

---

## 3. Công thức tính phân trang bị lặp

Khối 5 dòng dưới đây lặp lại ở **3 chỗ** trong 2 file:

| #   | File                          | Dòng     | Ngữ cảnh               |
| --- | ----------------------------- | -------- | ---------------------- |
| 1   | `src/routes/product.route.js` | L67–72   | `GET /category` route  |
| 2   | `src/routes/product.route.js` | L120–125 | `GET /search` route    |
| 3   | `src/routes/account.route.js` | L547–552 | `GET /watchlist` route |

**Code lặp:**

```js
// Lặp giống nhau ở 3 chỗ
const nPages = Math.ceil(totalCount / limit);
let from = (page - 1) * limit + 1;
let to = page * limit;
if (to > totalCount) to = totalCount;
if (totalCount === 0) {
  from = 0;
  to = 0;
}
```

**Cách sửa:** Tách vào `src/helpers/pagination.helper.js`:

```js
export function paginate(totalCount, page, limit) {
  const totalPages = Math.ceil(totalCount / limit);
  const from = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const to = totalCount === 0 ? 0 : Math.min(page * limit, totalCount);
  return { totalPages, from, to };
}
```

---

## 4. Parse mảng PostgreSQL dạng string bị lặp

Cùng một logic parse chạy **2 lần** liên tiếp trong `GET /complete-order` route cho hai trường khác nhau:

| #   | File                          | Dòng       | Trường                |
| --- | ----------------------------- | ---------- | --------------------- |
| 1   | `src/routes/product.route.js` | L1034–1041 | `payment_proof_urls`  |
| 2   | `src/routes/product.route.js` | L1046–1052 | `shipping_proof_urls` |

**Code lặp:**

```js
// Lặp 2 lần — chỉ khác tên trường
if (typeof invoice.xxx_urls === "string") {
  invoice.xxx_urls = invoice.xxx_urls
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split(",")
    .filter((url) => url);
}
```

**Cách sửa:** Tách ra `src/helpers/string.helper.js` (hoặc `common.helper.js`):

```js
export function parsePgArray(value) {
  if (!value || typeof value !== "string") return value ?? [];
  return value.replace(/^\{/, "").replace(/\}$/, "").split(",").filter(Boolean);
}
```

---

## 5. Xây dựng `productUrl` bị lặp

Template literal xây URL chi tiết sản phẩm bị lặp ở **4 chỗ** trong 3 file:

| #   | File                                | Dòng | Pattern                                                                                                       |
| --- | ----------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/product.route.js`       | L582 | `` `${req.protocol}://${req.get('host')}/products/detail?id=${productId}` ``                                  |
| 2   | `src/routes/product.route.js`       | L808 | `` `${req.protocol}://${req.get('host')}/products/detail?id=${productId}` ``                                  |
| 3   | `src/routes/seller.route.js`        | L345 | `` `${req.protocol}://${req.get('host')}/products/detail?id=${productId}` ``                                  |
| 4   | `src/scripts/auctionEndNotifier.js` | L24  | `` `${process.env.BASE_URL \|\| 'http://localhost:3005'}/products/detail?id=${auction.id}` `` (khác pattern!) |

**Cách sửa:** Tách vào `src/helpers/common.helper.js`:

```js
export function buildProductUrl(req, productId) {
  return `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;
}
```

---

## 6. Cấu hình multer upload bị lặp

Cấu hình `multer.diskStorage` (destination, filename) gần như giống hệt nhau được khai báo lại ở **3 file** riêng biệt. Khi cần thay đổi logic upload (đổi thư mục, đổi cách đặt tên file, thêm validation) phải chỉnh sửa nhiều nơi.

| #   | File                                | Dòng       | Có `fileFilter`?      | Có `limits`? |
| --- | ----------------------------------- | ---------- | --------------------- | ------------ |
| 1   | `src/routes/product.route.js`       | L1074–1099 | Có (jpeg/jpg/png/gif) | 5 MB         |
| 2   | `src/routes/seller.route.js`        | L171–181   | Không                 | Không        |
| 3   | `src/routes/admin/product.route.js` | L132–142   | Không                 | Không        |

**Code lặp (giống nhau ở cả 3 file):**

```js
// Lặp giống nhau — chỉ khác fileFilter & limits
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
```

**Cách sửa:** Tách vào `src/helpers/upload.helper.js`, export 2 biến thể:

```js
// src/helpers/upload.helper.js
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

/** General-purpose upload (image only, up to 5 MB) */
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed!"));
  },
});

/** Upload without file-type filtering (used for seller/admin images) */
export const uploadNoFilter = multer({ storage });
```

Sau đó các route chỉ cần import:

```js
// src/routes/product.route.js
import { upload } from "../helpers/upload.helper.js";

// src/routes/seller.route.js & src/routes/admin/product.route.js
import { uploadNoFilter as upload } from "../helpers/upload.helper.js";
```

---

## Tổng hợp

| #   | Vi phạm                           | File(s)                                                                                                   | Cách sửa đề xuất                                                                                          |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1a  | 3 khối HTML email inline          | `src/scripts/auctionEndNotifier.js`                                                                       | Tách `auctionWonNotify`, `auctionEndSellerWithWinner`, `auctionEndNoBidders` → `emailTemplates.helper.js` |
| 1b  | 1 khối HTML email inline          | `src/routes/admin/user.route.js`                                                                          | Tách `passwordResetNotify()` → `emailTemplates.helper.js`                                                 |
| 1c  | Nhiều khối HTML email inline      | `src/routes/product.route.js`, `src/routes/seller.route.js`                                               | Tách thành các hàm template → `emailTemplates.helper.js`                                                  |
| 2   | Logic xác định `productStatus` ×2 | `src/routes/product.route.js` (L153, L985)                                                                | Tách hàm `resolveProductStatus()` → `product.helper.js`                                                   |
| 3   | Công thức phân trang ×3           | `src/routes/product.route.js` (L67, L120), `src/routes/account.route.js` (L547)                           | Tách hàm `paginate()` → `pagination.helper.js`                                                            |
| 4   | Parse mảng PG ×2                  | `src/routes/product.route.js` (L1034, L1046)                                                              | Tách hàm `parsePgArray()` → `string.helper.js`                                                            |
| 5   | Tạo chuỗi `productUrl` ×4         | `src/routes/product.route.js` ×2, `src/routes/seller.route.js` ×1, `src/scripts/auctionEndNotifier.js` ×1 | Tách hàm `buildProductUrl()` → `common.helper.js`                                                         |
| 6   | Cấu hình multer upload ×3         | `src/routes/product.route.js`, `src/routes/seller.route.js`, `src/routes/admin/product.route.js`          | Tách `upload` / `uploadNoFilter` → `upload.helper.js`                                                     |
