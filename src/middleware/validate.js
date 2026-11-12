import { STATUS_CODES } from '../constants/statusCodes.js';

/**
 * Middleware factory for validating incoming requests with Zod schemas.
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} source 
 */
export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error.errors) {
        const formattedErrors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed for request data.',
          errors: formattedErrors,
        });
      }
      next(error);
    }
  };
};
