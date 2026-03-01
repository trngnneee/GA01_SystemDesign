# Báo cáo vi phạm KISS (Keep It Simple, Stupid)

**Nguyên tắc KISS**: _Simplicity should be a key goal in design, and unnecessary complexity should be avoided._

---

## KISS-1 — `src/index.js` (L167): Debug `console.log` trong production code

**Vấn đề**: Có một `console.log(end)` được để lại trong hàm `format_time_remaining` (L164). Đây là code thừa, không phục vụ mục đích gì trong production, làm nhiễu output và gây nhầm lẫn cho người đọc.

| Vị trí              | Hàm                     | Dòng lỗi |
| ------------------- | ----------------------- | -------- |
| `src/index.js` L167 | `format_time_remaining` | L167     |

**Code vi phạm (L164–168):**

```js
// BEFORE – thừa, không cần thiết
format_time_remaining(date) {
  const now = new Date();
  const end = new Date(date);
  console.log(end); // ← L167: không cần, debug thừa
  const diff = end - now;
  ...
}
```

**Cách sửa:**

```js
// AFTER – sạch, không có side effect thừa
format_time_remaining(date) {
  const now = new Date();
  const end = new Date(date);
  const diff = end - now;
  ...
}
```

---

## KISS-2 — `src/index.js` (L181): NaN guard đặt sai vị trí

**Vấn đề**: Kiểm tra `isNaN(end.getTime())` được đặt ở L181 — bên trong nhánh `if (days > 3)` — tức là **sau** khi đã tính `diff`, `days`, `hours`, `minutes`, `seconds` từ `end` (L168–176). Nếu `end` không hợp lệ, toàn bộ các phép tính đó cho ra `NaN`. Logic gây khó hiểu và che giấu lỗi tiềm ẩn.

| Vị trí              | Hàm                     | Dòng guard sai |
| ------------------- | ----------------------- | -------------- |
| `src/index.js` L181 | `format_time_remaining` | L181           |

**Code vi phạm (L164–181):**

```js
// BEFORE – guard đặt muộn, logic rối
format_time_remaining(date) {
  const now = new Date();
  const end = new Date(date);
  console.log(end);
  const diff = end - now;             // L168: diff = NaN nếu end không hợp lệ

  if (diff <= 0) return "Auction Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));    // NaN
  const hours = Math.floor(...);                              // NaN
  const minutes = Math.floor(...);                            // NaN
  const seconds = Math.floor(...);                            // NaN

  if (days > 3) {
    if (isNaN(end.getTime())) return ""; // ← L181: guard đặt quá muộn!
    ...
  }
}
```

**Cách sửa:**

```js
// AFTER – guard đặt ngay đầu, rõ ràng
format_time_remaining(date) {
  const end = new Date(date);
  if (isNaN(end.getTime())) return ""; // ← guard sớm, dễ hiểu
  const now = new Date();
  const diff = end - now;
  ...
}
```

---

## KISS-3 — `src/index.js` (L182–189): Thủ công format ngày với 6 dòng `padStart`

**Vấn đề**: Khi `days > 3`, hàm `format_time_remaining` tự trích xuất từng phần của ngày (year, month, day, hour, minute, second) rồi `padStart` từng cái — 6 dòng code chỉ để tạo một chuỗi ngày giờ (L182–189). Logic format datetime tương tự đã viết ở hàm `format_date` (L101), không cần lặp lại thủ công.

| Vị trí                  | Hàm                     | Số dòng boilerplate |
| ----------------------- | ----------------------- | ------------------- |
| `src/index.js` L182–189 | `format_time_remaining` | 6 dòng              |

**Code vi phạm (L180–189):**

```js
// BEFORE – 6 dòng boilerplate trong format_time_remaining
if (days > 3) {
  if (isNaN(end.getTime())) return "";
  const year = end.getFullYear(); // L182
  const month = String(end.getMonth() + 1).padStart(2, "0"); // L183
  const day = String(end.getDate()).padStart(2, "0"); // L184
  const hour = String(end.getHours()).padStart(2, "0"); // L186
  const minute = String(end.getMinutes()).padStart(2, "0"); // L187
  const second = String(end.getSeconds()).padStart(2, "0"); // L188
  return `${hour}:${minute}:${second} ${day}/${month}/${year}`; // L189
}
```

**Cách sửa:**

```js
// AFTER – 1 dòng, dùng pad helper cục bộ
const pad = (n) => String(n).padStart(2, "0");

if (days > 3) {
  if (isNaN(end.getTime())) return "";
  return `${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())} ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
}
```

---

## KISS-4 — `src/index.js` (L287): `Math.pow` tính lặp hai lần trong `round()`

**Vấn đề**: Hàm `round()` (L285) gọi `Math.pow(10, decimals)` **hai lần** cho cùng một giá trị — một lần để nhân, một lần để chia. Biểu thức dài hơn cần thiết và phải đọc kỹ mới nhận ra hai phép tính là giống nhau.

| Vị trí              | Hàm     | Số lần gọi `Math.pow` |
| ------------------- | ------- | --------------------- |
| `src/index.js` L287 | `round` | 2 lần                 |

**Code vi phạm (L285–288):**

```js
// BEFORE – Math.pow gọi 2 lần, khó đọc
round(value, decimals) {
  return (
    Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
  );
},
```

**Cách sửa:**

```js
// AFTER – lưu vào biến, rõ ý định
round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
},
```

---

## KISS-5 — `src/index.js` (L101–145): Lặp lại boilerplate `padStart` trên 4 hàm format ngày

**Vấn đề**: Cả 4 hàm format ngày đều khai báo từng biến riêng (`year`, `month`, `day`, `hour`, ...) rồi gọi `String(x).padStart(2, '0')` cho từng phần — tổng cộng ~6–8 dòng boilerplate mỗi hàm. Một local `pad` helper đơn giản giảm mỗi hàm xuống còn 1–2 dòng.

| Vị trí                  | Hàm                 | Số dòng `padStart` |
| ----------------------- | ------------------- | ------------------ |
| `src/index.js` L107–112 | `format_date`       | 6 dòng             |
| `src/index.js` L122–123 | `format_only_date`  | 2 dòng             |
| `src/index.js` L132–134 | `format_only_time`  | 3 dòng             |
| `src/index.js` L143–144 | `format_date_input` | 2 dòng             |

**Code vi phạm — ví dụ `format_date` (L101–114):**

```js
// BEFORE – 6 dòng padStart boilerplate
format_date(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();                              // L106
  const month = String(d.getMonth() + 1).padStart(2, "0");  // L107
  const day = String(d.getDate()).padStart(2, "0");          // L108
  const hour = String(d.getHours()).padStart(2, "0");        // L110
  const minute = String(d.getMinutes()).padStart(2, "0");    // L111
  const second = String(d.getSeconds()).padStart(2, "0");    // L112
  return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
},
```

**Cách sửa — khai báo `pad` 1 lần, dùng cho cả 4 hàm:**

```js
// AFTER – khai báo pad helper 1 lần bên ngoài
const pad = (n) => String(n).padStart(2, "0");

// Mỗi hàm chỉ còn 1–2 dòng
format_date(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
},

format_only_date(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
},

format_only_time(time) {
  if (!time) return "";
  const d = new Date(time);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
},

format_date_input(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
},
```

---

## Tổng kết

| #      | File           | Hàm                                                                                   | Vấn đề                                       | Mức độ     |
| ------ | -------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- | ---------- |
| KISS-1 | `src/index.js` | `format_time_remaining` (L167)                                                        | `console.log` debug thừa trong production    | Thấp       |
| KISS-2 | `src/index.js` | `format_time_remaining` (L181)                                                        | NaN guard đặt sai vị trí — sau khi đã tính   | Trung bình |
| KISS-3 | `src/index.js` | `format_time_remaining` (L182–189)                                                    | 6-line manual date format thay vì dùng `pad` | Trung bình |
| KISS-4 | `src/index.js` | `round` (L287)                                                                        | `Math.pow` gọi 2 lần cho cùng giá trị        | Thấp       |
| KISS-5 | `src/index.js` | `format_date`, `format_only_date`, `format_only_time`, `format_date_input` (L101–145) | padStart boilerplate lặp trên 4 hàm          | Trung bình |
