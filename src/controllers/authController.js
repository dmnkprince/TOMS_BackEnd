import { authService } from '../services/authService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const authController = {
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

  async getMe(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      return sendResponse(res, STATUS_CODES.OK, 'Current user profile retrieved.', profile);
    } catch (error) {
      next(error);
    }
  },

  async logout(req, res, next) {
    try {
      // In stateless JWT architectures, frontend discards the token.
      return sendResponse(res, STATUS_CODES.OK, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  },

  async registerStaff(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const newStaff = await authService.register(req.body, req.user?.id, ipAddress);

      return sendResponse(res, STATUS_CODES.CREATED, 'Staff account created successfully.', newStaff);
    } catch (error) {
      next(error);
    }
  },
};
