import { authService } from '../services/authService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const profileController = {
  async getProfiles(req, res, next) {
    try {
      const { role, status, search, page, limit } = req.query;
      const result = await authService.getProfiles({ role, status, search, page, limit });

      return sendResponse(res, STATUS_CODES.OK, 'Profiles retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  },

  async getProfile(req, res, next) {
    try {
      const profile = await authService.getProfile(req.params.id);
      return sendResponse(res, STATUS_CODES.OK, 'Profile details retrieved.', profile);
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { id } = req.params;
      const isSelfOrAdmin = req.user.id === id || req.user.role === 'admin';

      if (!isSelfOrAdmin) {
        return res.status(STATUS_CODES.FORBIDDEN).json({
          success: false,
          message: 'You are only authorized to update your own profile.',
        });
      }

      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const updated = await authService.updateProfile(id, req.body, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.OK, 'Profile updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  async updateRoleAndStatus(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const updated = await authService.updateRoleAndStatus(id, req.body, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.OK, 'Staff role and status updated.', updated);
    } catch (error) {
      next(error);
    }
  },
};
