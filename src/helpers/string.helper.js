function truncate(str, len) {
  if (!str) return "";
  if (str.length <= len) return str;
  return str.substring(0, len) + "...";
}

function replace(str, search, replaceWith) {
  if (!str) return "";
  return str.replace(new RegExp(search, "g"), replaceWith);
}

/**
 * Parse chuỗi mảng PostgreSQL dạng "{a,b,c}" thành mảng JS.
 */
export function parsePgArray(value) {
  if (!value || typeof value !== "string") return value ?? [];
  return value.replace(/^\{/, "").replace(/\}$/, "").split(",").filter(Boolean);
}

function mask_name(fullname) {
  if (!fullname) return null;
  const name = fullname.trim();
  if (name.length === 0) return null;
  if (name.length === 1) return "*";
  if (name.length === 2) return name[0] + "*";

  // Mã hóa xen kẽ: giữ ký tự ở vị trí chẵn (0,2,4...), thay bằng * ở vị trí lẻ (1,3,5...)
  // Khoảng trắng cũng được xử lý như ký tự bình thường
  let masked = "";
  for (let i = 0; i < name.length; i++) {
    if (i % 2 === 0) {
      masked += name[i]; // Giữ nguyên ký tự ở vị trí chẵn (kể cả khoảng trắng)
    } else {
      masked += "*"; // Thay bằng * ở vị trí lẻ
    }
  }
  return masked;
}

function length(value) {
  if (!value) return 0;
  return value.length;
}

export default {
  truncate,
  replace,
  mask_name,
  length,
};
