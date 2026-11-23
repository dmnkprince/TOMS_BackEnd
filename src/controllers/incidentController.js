import { incidentService } from '../services/incidentService.js';


import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const incidentController = {
  /**
   * Registers a new traffic incident.
   * Immediately searchable.
   */
  async registerIncident(req, res, next) {
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const agentId = req.user.id;

      const newIncident = await incidentService.registerIncident(req.body, agentId, ipAddress);

      return sendResponse(
        res,
        STATUS_CODES.CREATED,
        `Incident registered successfully with reference ${newIncident.reference_number}.`,
        newIncident
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Advanced multi-filter search with pagination.
   */
  async searchIncidents(req, res, next) {
    try {
      const queryParams = { ...req.query };

      const result = await incidentService.searchIncidents(queryParams);

      return sendResponse(res, STATUS_CODES.OK, 'Incidents retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves single incident by primary UUID.
   */
  async getIncidentById(req, res, next) {
    try {
      const { id } = req.params;
      const incident = await incidentService.getIncidentById(id);

      return sendResponse(res, STATUS_CODES.OK, 'Incident details retrieved.', incident);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves single incident by Reference Number (e.g. TOMS-20261112-9A4B).
   */
  async getIncidentByReference(req, res, next) {
    try {
      const { referenceNumber } = req.params;
      const incident = await incidentService.getIncidentByReference(referenceNumber);

      return sendResponse(res, STATUS_CODES.OK, 'Incident details retrieved.', incident);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Updates an existing incident record (Supervisors and Admins only).
   */
  async updateIncident(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const userId = req.user.id;

      const updatedIncident = await incidentService.updateIncident(id, req.body, userId, ipAddress);

      return sendResponse(
        res,
        STATUS_CODES.OK,
        `Incident ${updatedIncident.reference_number || id} updated successfully.`,
        updatedIncident
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Deletes an existing incident record (Supervisors and Admins only).
   */
  async deleteIncident(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const userId = req.user.id;

      const result = await incidentService.deleteIncident(id, userId, ipAddress);

      return sendResponse(
        res,
        STATUS_CODES.OK,
        `Incident ${result.reference_number || id} deleted successfully.`,
        result
      );
    } catch (error) {
      next(error);
    }
  },
};
