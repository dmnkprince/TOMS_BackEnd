import { STATUS_CODES } from '../constants/statusCodes.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle PostgreSQL specific errors
  if (err.code === '23505') {
    return res.status(STATUS_CODES.CONFLICT).json({
      success: false,
      message: 'A duplicate record already exists with the provided unique identifier.',
      error: err.detail || err.message,
    });
  }

  if (err.code === '23503') {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: 'Referenced record (foreign key) does not exist.',
      error: err.detail || err.message,
    });
  }

  // Handle custom application errors or standard errors
  const statusCode = err.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
