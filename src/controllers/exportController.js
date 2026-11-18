import { ROLES } from '../constants/roles.js';
import { authService } from '../services/authService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const exportController = {
  // Export all profiles (admin / supervisor)
  async exportProfiles(req, res, next) {
    try {
      // ---- Role enforcement (defense in depth) ----
      const userRole = req.user?.role;
      if (!userRole || ![ROLES.ADMIN, ROLES.SUPERVISOR].includes(userRole)) {
        const err = new Error('Access denied: only admins or supervisors may export profiles.');
        err.statusCode = 403;
        throw err;
      }

      const data = await authService.exportProfiles();
      // Set download headers (JSON for simplicity)
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="profiles.json"');
      return sendResponse(res, STATUS_CODES.OK, 'Profiles exported successfully.', data);
    } catch (error) {
      next(error);
    }
  },
};

