import { STATUS_CODES } from '../constants/statusCodes.js';
import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  // Handle SQLite / Turso / PostgreSQL Constraint Violations
  const errorMessage = err.message || '';

  if (
    err.code === '23505' ||
    err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    errorMessage.includes('UNIQUE constraint failed')
  ) {
    return res.status(STATUS_CODES.CONFLICT).json({
      success: false,
      message: 'A duplicate record already exists with the provided unique identifier.',
    });
  }

  if (
    err.code === '23503' ||
    err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    errorMessage.includes('FOREIGN KEY constraint failed')
  ) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: 'Referenced record (foreign key) does not exist.',
    });
  }

  const statusCode = err.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
  const isProd = ENV.NODE_ENV === 'production';

  // In production, mask internal server errors
  const clientMessage =
    statusCode === STATUS_CODES.INTERNAL_SERVER_ERROR && isProd
      ? 'An internal server error occurred. Please contact the administrator.'
      : err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(!isProd && { stack: err.stack }),
  });
};
