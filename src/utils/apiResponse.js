import { STATUS_CODES } from '../constants/statusCodes.js';

export const sendResponse = (res, statusCode = STATUS_CODES.OK, message = 'Success', data = null) => {
  const isSuccess = statusCode >= 200 && statusCode < 300;
  return res.status(statusCode).json({
    success: isSuccess,
    message,
    data,
  });
};

export const sendError = (res, statusCode = STATUS_CODES.BAD_REQUEST, message = 'An error occurred', details = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: details,
  });
};
