/**
 * Xác định trạng thái của sản phẩm dựa trên các trường is_sold, closed_at, end_at.
 * Dùng chung cho getProductDetail và getCompleteOrder.
 * @returns {"SOLD"|"CANCELLED"|"PENDING"|"EXPIRED"|"ACTIVE"}
 */
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
