import { auditLogService } from '../services/auditLogService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const auditLogController = {
  async getLogs(req, res, next) {
    try {
      const { page, limit, action, entity_type, user_id, start_date, end_date } = req.query;

      const result = await auditLogService.getLogs({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        action,
        entityType: entity_type,
        userId: user_id,
        startDate: start_date,
        endDate: end_date,
      });

      return sendResponse(res, STATUS_CODES.OK, 'Audit logs retrieved.', result);
    } catch (error) {
      next(error);
    }
  },
};
