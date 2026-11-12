import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { pool } from '../config/db.js';
import { supabase } from '../config/supabase.js';
import { STATUS_CODES } from '../constants/statusCodes.js';

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
    let userId = null;
    let userEmail = null;

    // 1. Attempt Supabase Auth verification if available
    try {
      if (ENV.SUPABASE_ANON_KEY && !ENV.SUPABASE_ANON_KEY.startsWith('dummy')) {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          userId = user.id;
          userEmail = user.email;
        }
      }
    } catch (sbErr) {
      // Fallback to local JWT verification
    }

    // 2. If not verified via Supabase, verify using local JWT
    if (!userId) {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET);
        userId = decoded.id;
        userEmail = decoded.email;
      } catch (jwtErr) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid or expired session token.',
          error: jwtErr.message,
        });
      }
    }

    // 3. Fetch current profile from database
    const profileResult = await pool.query(
      `SELECT id, full_name, badge_number, email, role, phone_number, status 
       FROM profiles 
       WHERE id = $1 OR email = $2 
       LIMIT 1`,
      [userId, userEmail]
    );

    if (profileResult.rows.length === 0) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: 'User profile not found for this authenticated account.',
      });
    }

    const profile = profileResult.rows[0];

    // 4. Ensure account is active
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
