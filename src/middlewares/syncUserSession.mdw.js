import * as userModel from "../models/user.model.js";

async function syncUserSession(req, res, next) {
  // Nếu user đã đăng nhập, kiểm tra xem thông tin có thay đổi không
  if (req.session.isAuthenticated && req.session.authUser) {
    const currentUser = await userModel.findById(req.session.authUser.id);

    // Nếu không tìm thấy user (bị xóa) hoặc thông tin đã thay đổi, cập nhật session
    if (!currentUser) {
      // User bị xóa, đăng xuất
      req.session.isAuthenticated = false;
      req.session.authUser = null;
    } else {
      // Cập nhật thông tin mới từ DB vào session
      req.session.authUser = {
        id: currentUser.id,
        username: currentUser.username,
        fullname: currentUser.fullname,
        email: currentUser.email,
        role: currentUser.role,
        address: currentUser.address,
        date_of_birth: currentUser.date_of_birth,
        email_verified: currentUser.email_verified,
        oauth_provider: currentUser.oauth_provider,
        oauth_id: currentUser.oauth_id
      };
    }
  }
  next();
}

export default syncUserSession;