import * as userModel from "../../models/user.model.js";
import * as upgradeRequestModel from "../../models/upgradeRequest.model.js";
import { sendMail } from "../../utils/mailer.js";
import { passwordResetNotify } from "../../helpers/emailTemplates.helper.js";

import * as passwordService from "../../service/password.service.js";

export const listUsersGet = async (req, res) => {
  const users = await userModel.loadAllUsers();
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;

  delete req.session.success_message;
  delete req.session.error_message;

  res.render("vwAdmin/users/list", {
    users,
    empty: users.length === 0,
    success_message,
    error_message,
  });
};

export const userDetailGet = async (req, res) => {
  const id = req.params.id;
  const user = await userModel.findById(id);
  res.render("vwAdmin/users/detail", { user });
};

export const addUserGet = async (req, res) => {
  res.render("vwAdmin/users/add");
};

export const addUserPost = async (req, res) => {
  try {
    const {
      fullname,
      email,
      address,
      date_of_birth,
      role,
      email_verified,
      password,
    } = req.body;
    const hashedPassword = await passwordService.hashPassword(password);
    const newUser = {
      fullname,
      email,
      address,
      date_of_birth: date_of_birth || null,
      role,
      email_verified: email_verified === "true",
      password_hash: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await userModel.add(newUser);
    req.session.success_message = "User added successfully!";
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Add user error:", error);
    req.session.error_message = "Failed to add user. Please try again.";
    res.redirect("/admin/users/add");
  }
};

export const showEditUserForm = async (req, res) => {
  const id = req.params.id;
  const user = await userModel.findById(id);
  const error_message = req.session.error_message;

  delete req.session.error_message;

  res.render("vwAdmin/users/edit", { user, error_message });
};

export const editUser = async (req, res) => {
  try {
    const {
      id,
      fullname,
      email,
      address,
      date_of_birth,
      role,
      email_verified,
    } = req.body;

    const updateData = {
      fullname,
      email,
      address,
      date_of_birth: date_of_birth || null,
      role,
      email_verified: email_verified === "true",
      updated_at: new Date(),
    };

    await userModel.update(id, updateData);
    req.session.success_message = "User updated successfully!";
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Update user error:", error);
    req.session.error_message = "Failed to update user. Please try again.";
    res.redirect(`/admin/users/edit/${req.body.id}`);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { id } = req.body;
    const defaultPassword = await passwordService.generateDefaultPassword();
    const hashedPassword = await passwordService.hashPassword(defaultPassword);

    // Get user info to send email
    const user = await userModel.findById(id);

    await userModel.update(id, {
      password_hash: hashedPassword,
      updated_at: new Date(),
    });

    // Send email notification to user
    if (user && user.email) {
      try {
        await sendMail({
          to: user.email,
          subject: "Your Password Has Been Reset - Online Auction",
          html: passwordResetNotify({
            userName: user.fullname,
            newPassword: defaultPassword,
          }),
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Continue even if email fails - password is still reset
      }
    }

    req.session.success_message = `Password of ${user.fullname} reset successfully to default: 123`;
    res.redirect(`/admin/users/list`);
  } catch (error) {
    console.error("Reset password error:", error);
    req.session.error_message = "Failed to reset password. Please try again.";
    res.redirect(`/admin/users/list`);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    await userModel.deleteUser(id);
    req.session.success_message = "User deleted successfully!";
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Delete user error:", error);
    req.session.error_message = "Failed to delete user. Please try again.";
    res.redirect("/admin/users/list");
  }
};

export const listUpgradeRequests = async (req, res) => {
  const requests = await upgradeRequestModel.loadAllUpgradeRequests();
  res.render("vwAdmin/users/upgradeRequests", { requests });
};

export const approveUpgrade = async (req, res) => {
  const id = req.body.id;
  const bidderId = req.body.bidder_id;
  // Logic to approve the upgrade request
  await upgradeRequestModel.approveUpgradeRequest(id);
  await userModel.updateUserRoleToSeller(bidderId);
  res.redirect("/admin/users/upgrade-requests");
};

export const rejectUpgrade = async (req, res) => {
  const id = req.body.id;
  const admin_note = req.body.admin_note;
  await upgradeRequestModel.rejectUpgradeRequest(id, admin_note);
  // Logic to reject the upgrade request
  res.redirect("/admin/users/upgrade-requests");
};
