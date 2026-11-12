import rateLimit from 'express-rate-limit';
import { STATUS_CODES } from '../constants/statusCodes.js';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.',
  },
  statusCode: STATUS_CODES.TOO_MANY_REQUESTS,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter limit on authentication endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  statusCode: STATUS_CODES.TOO_MANY_REQUESTS,
});
