import { STATUS_CODES } from '../constants/statusCodes.js';

/**
 * Middleware to restrict route access by role.
 * @param {string[]} allowedRoles Array of permitted roles (e.g. ['admin', 'supervisor'])
 */
export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required prior to permission verification.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Your role is '${req.user.role}'.`,
      });
    }

    next();
  };
};
