import { authService } from '../services/authService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';
import { ROLES, ALL_ROLES } from '../constants/roles.js';

export const authController = {
  // Login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const result = await authService.login(email, password, ipAddress);
      return sendResponse(res, STATUS_CODES.OK, 'Login successful.', result);
    } catch (error) {
      next(error);
    }
  },

  // Get current user profile
  async getMe(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      return sendResponse(res, STATUS_CODES.OK, 'Current user profile retrieved.', profile);
    } catch (error) {
      next(error);
    }
  },

  // Logout
  async logout(req, res, next) {
    try {
      return sendResponse(res, STATUS_CODES.OK, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  },

  // Register staff (admin / supervisor)
  async registerStaff(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const newStaff = await authService.register(req.body, req.user?.id, ipAddress);
      return sendResponse(res, STATUS_CODES.CREATED, 'Staff account created successfully.', newStaff);
    } catch (error) {
      next(error);
    }
  },

  // Delete a user (admin / supervisor)
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const actorId = req.user.id;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      if (id === actorId) {
        const err = new Error('You cannot delete your own account.');
        err.statusCode = 400;
        throw err;
      }
      await authService.deleteUser(id, actorId, ipAddress);
      return sendResponse(res, STATUS_CODES.OK, 'User deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // Get list of users (admin / supervisor)
  async getUsers(req, res, next) {
    try {
      const { role, status, search, page, limit } = req.query;
      const profiles = await authService.getProfiles({
        role,
        status,
        search,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });
      return sendResponse(res, STATUS_CODES.OK, 'User list retrieved.', profiles);
    } catch (error) {
      next(error);
    }
  },

  // Update a user (admin / supervisor)
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.user;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const updateData = { ...req.body };

      // Role change permission & validation
      if (updateData.role !== undefined) {
        if (actor.role !== ROLES.ADMIN) {
          const err = new Error('Access Denied: Only an Administrator can change user roles.');
          err.statusCode = 403;
          throw err;
        }
        if (!ALL_ROLES.includes(updateData.role)) {
          const err = new Error(`Invalid role. Allowed roles: ${ALL_ROLES.join(', ')}`);
          err.statusCode = 400;
          throw err;
        }
        if (id === actor.id && updateData.role !== ROLES.ADMIN) {
          const err = new Error('You cannot change your own Administrator role.');
          err.statusCode = 400;
          throw err;
        }
      }

      const updated = await authService.updateProfile(id, updateData, actor.id, ipAddress);
      return sendResponse(res, STATUS_CODES.OK, 'User updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  // Password request handlers ... (unchanged)

  // Login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const result = await authService.login(email, password, ipAddress);
      return sendResponse(res, STATUS_CODES.OK, 'Login successful.', result);
    } catch (error) {
      next(error);
    }
  },

  // Get current user profile
  async getMe(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      return sendResponse(res, STATUS_CODES.OK, 'Current user profile retrieved.', profile);
    } catch (error) {
      next(error);
    }
  },

  // Logout
  async logout(req, res, next) {
    try {
      return sendResponse(res, STATUS_CODES.OK, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  },

  // Register staff (admin / supervisor)
  async registerStaff(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const newStaff = await authService.register(req.body, req.user?.id, ipAddress);
      return sendResponse(res, STATUS_CODES.CREATED, 'Staff account created successfully.', newStaff);
    } catch (error) {
      next(error);
    }
  },

  // Delete a user (admin / supervisor)
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const actorId = req.user.id;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      // Prevent self‑deletion
      if (id === actorId) {
        const err = new Error('You cannot delete your own account.');
        err.statusCode = 400;
        throw err;
      }
      await authService.deleteUser(id, actorId, ipAddress);
      return sendResponse(res, STATUS_CODES.OK, 'User deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // Password change request (public or authenticated)
  async requestPasswordChange(req, res, next) {
    try {
      const result = await authService.requestPasswordChange(req.body);
      return sendResponse(
        res,
        STATUS_CODES.CREATED,
        'Password change request submitted. Admin approval required.',
        result
      );
    } catch (error) {
      next(error);
    }
  },

  // Get all password change requests (admin only)
  async getPasswordRequests(req, res, next) {
    try {
      const requests = await authService.getPasswordRequests();
      return sendResponse(res, STATUS_CODES.OK, 'Password requests retrieved.', requests);
    } catch (error) {
      next(error);
    }
  },

  // Approve a password request (admin only)
  async approvePasswordRequest(req, res, next) {
    try {
      const { id } = req.params;
      const admin = req.user;
      const result = await authService.approvePasswordRequest(id, admin);
      return sendResponse(res, STATUS_CODES.OK, 'Password change request approved by Administrator.', result);
    } catch (error) {
      next(error);
    }
  },

  // Reject a password request (admin only)
  async rejectPasswordRequest(req, res, next) {
    try {
      const { id } = req.params;
      const admin = req.user;
      const { reason } = req.body;
      const result = await authService.rejectPasswordRequest(id, admin, reason);
      return sendResponse(res, STATUS_CODES.OK, 'Password change request rejected.', result);
    } catch (error) {
      next(error);
    }
  },
};