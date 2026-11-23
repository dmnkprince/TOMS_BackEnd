import rateLimit from 'express-rate-limit';
import { STATUS_CODES } from '../constants/statusCodes.js';

// Skip rate limiting for uptime monitors and container health checks
const isHealthCheck = (req) => {
  const path = req.path || req.originalUrl || '';
  return path.endsWith('/health') || path.endsWith('/healthz');
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Elevated to 500 to handle busy traffic shifts comfortably
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isHealthCheck(req),
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.',
  },
  statusCode: STATUS_CODES.TOO_MANY_REQUESTS,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Elevated to 30 to allow legitimate retries while thwarting brute force
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isHealthCheck(req),
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  statusCode: STATUS_CODES.TOO_MANY_REQUESTS,
});
