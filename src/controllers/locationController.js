import { locationService } from '../services/locationService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const locationController = {
  async getLocations(req, res, next) {
    try {
      const { is_active } = req.query;
      const isActiveOnly = is_active !== undefined ? is_active === 'true' : true;

      const locations = await locationService.getAllLocations(isActiveOnly);
      return sendResponse(res, STATUS_CODES.OK, 'Locations retrieved successfully.', locations);
    } catch (error) {
      next(error);
    }
  },

  async getLocationById(req, res, next) {
    try {
      const location = await locationService.getLocationById(req.params.id);
      return sendResponse(res, STATUS_CODES.OK, 'Location details retrieved.', location);
    } catch (error) {
      next(error);
    }
  },

  async createLocation(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const newLocation = await locationService.createLocation(req.body, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.CREATED, 'Location created successfully.', newLocation);
    } catch (error) {
      next(error);
    }
  },

  async updateLocation(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const updated = await locationService.updateLocation(req.params.id, req.body, req.user.id, ipAddress);

      return sendResponse(res, STATUS_CODES.OK, 'Location updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },
};
