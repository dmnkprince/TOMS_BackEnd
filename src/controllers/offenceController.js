import { offenceService } from '../services/offenceService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const offenceController = {
  async getOffences(req, res, next) {
    try {
      const { category, is_active } = req.query;
      const isActiveOnly = is_active !== undefined ? is_active === 'true' : false;

      const offences = await offenceService.getAllOffences({ category, isActiveOnly });
      return sendResponse(res, STATUS_CODES.OK, 'Offence types retrieved successfully.', offences);
    } catch (error) {
      next(error);
    }
  },

  async getOffenceById(req, res, next) {
    try {
      const offence = await offenceService.getOffenceById(req.params.id);
      return sendResponse(res, STATUS_CODES.OK, 'Offence type details retrieved.', offence);
    } catch (error) {
      next(error);
    }
  },

  async createOffence(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const newOffence = await offenceService.createOffence(req.body, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.CREATED, 'Offence type created successfully.', newOffence);
    } catch (error) {
      next(error);
    }
  },

  async updateOffence(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const updated = await offenceService.updateOffence(req.params.id, req.body, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.OK, 'Offence type updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  async toggleStatus(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const updated = await offenceService.toggleStatus(req.params.id, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.OK, 'Offence type status toggled successfully.', updated);
    } catch (error) {
      next(error);
    }
  },
};
