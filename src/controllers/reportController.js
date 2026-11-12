import { reportService } from '../services/reportService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const reportController = {
  async getSummary(req, res, next) {
    try {
      const stats = await reportService.getSummaryStats();
      return sendResponse(res, STATUS_CODES.OK, 'System summary statistics retrieved.', stats);
    } catch (error) {
      next(error);
    }
  },

  async getTopOffences(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      const topOffences = await reportService.getTopOffences(limit);
      return sendResponse(res, STATUS_CODES.OK, 'Top offences retrieved successfully.', topOffences);
    } catch (error) {
      next(error);
    }
  },

  async getAgentPerformance(req, res, next) {
    try {
      const { start_date, end_date } = req.query;
      const performance = await reportService.getAgentPerformance({ startDate: start_date, endDate: end_date });
      return sendResponse(res, STATUS_CODES.OK, 'Agent performance report generated.', performance);
    } catch (error) {
      next(error);
    }
  },

  async getLocationHotspots(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      const hotspots = await reportService.getLocationHotspots(limit);
      return sendResponse(res, STATUS_CODES.OK, 'Location hotspots retrieved.', hotspots);
    } catch (error) {
      next(error);
    }
  },
};
