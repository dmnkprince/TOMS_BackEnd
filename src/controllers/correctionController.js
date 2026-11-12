import { correctionService } from '../services/correctionService.js';
import { sendResponse } from '../utils/apiResponse.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const correctionController = {
  /**
   * Submits a new correction request for an incident.
   */
  async submitRequest(req, res, next) {
    try {
      const { incident_id, reason, proposed_changes } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];

      const result = await correctionService.submitRequest({
        incidentId: incident_id,
        reason,
        proposedChanges: proposed_changes,
        requesterId: req.user.id,
        ipAddress,
      });

      return sendResponse(
        res,
        STATUS_CODES.CREATED,
        'Correction request submitted successfully and queued for review.',
        result
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lists correction requests.
   * Agents view only their own requests; Supervisors/Admins can view all.
   */
  async getRequests(req, res, next) {
    try {
      const { status, requester_id, page, limit } = req.query;
      const isSupervisorOrAdmin = ['supervisor', 'admin'].includes(req.user.role);

      const result = await correctionService.getRequests({
        status,
        requesterId: isSupervisorOrAdmin ? requester_id : req.user.id,
        isSupervisorOrAdmin,
        page,
        limit,
      });

      return sendResponse(res, STATUS_CODES.OK, 'Correction requests retrieved.', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves single correction request details.
   */
  async getRequestById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await correctionService.getRequestById(id);

      // Verify access: agents can only inspect their own request
      if (req.user.role === 'agent' && result.requested_by !== req.user.id) {
        return res.status(STATUS_CODES.FORBIDDEN).json({
          success: false,
          message: 'You are not authorized to view this correction request.',
        });
      }

      return sendResponse(res, STATUS_CODES.OK, 'Correction request details retrieved.', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Approves or rejects a correction request (Supervisors and Admins only).
   */
  async reviewRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { status, rejection_reason } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];

      const result = await correctionService.reviewRequest({
        requestId: id,
        status,
        rejectionReason: rejection_reason,
        reviewerId: req.user.id,
        ipAddress,
      });

      return sendResponse(
        res,
        STATUS_CODES.OK,
        `Correction request has been ${status}.`,
        result
      );
    } catch (error) {
      next(error);
    }
  },
};
