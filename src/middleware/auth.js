import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { turso } from '../config/db.js';
import { STATUS_CODES } from '../constants/statusCodes.js';
import { cacheService } from '../utils/cacheService.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication token missing or invalid. Please provide a valid Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch (jwtErr) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid or expired session token.',
        error: jwtErr.message,
      });
    }

    const cacheKey = `session:user:${decoded.id || decoded.email}`;
    let profile = await cacheService.get(cacheKey);

    if (!profile) {
      // Cache Miss: Query Turso database
      const profileResult = await turso.execute({
        sql: `SELECT id, full_name, badge_number, email, role, phone_number, status 
              FROM profiles 
              WHERE id = ? OR email = ? 
              LIMIT 1`,
        args: [decoded.id, decoded.email],
      });

      if (profileResult.rows.length === 0) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User profile not found for this authenticated account.',
        });
      }

      profile = profileResult.rows[0];
      // Store in L1/L2 cache for 10 minutes (600s)
      await cacheService.set(cacheKey, profile, 600);
    }

    // Ensure account is active
    if (profile.status !== 'active') {
      return res.status(STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: `Account is currently ${profile.status}. Contact an administrator.`,
      });
    }

    // Attach to request object
    req.user = profile;
    next();
  } catch (error) {
    next(error);
  }
};
