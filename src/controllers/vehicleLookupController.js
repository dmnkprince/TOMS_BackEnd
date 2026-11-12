import { vehicleLookupService } from '../services/vehicleLookupService.js';
import { sendResponse, sendError } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const vehicleLookupController = {
  async lookupByPlate(req, res, next) {
    try {
      const { plateNumber } = req.params;
      if (!plateNumber || plateNumber.trim().length === 0) {
        return sendError(res, STATUS_CODES.BAD_REQUEST, 'Plate number must be provided in parameter.');
      }

      const lookupResult = await vehicleLookupService.lookupByPlate(plateNumber);
      return sendResponse(res, STATUS_CODES.OK, lookupResult.message, lookupResult);
    } catch (error) {
      next(error);
    }
  },
};
