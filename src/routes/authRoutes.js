import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { loginSchema, registerUserSchema } from '../validators/authValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Public: Log into TOMS
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Authenticated: Get current user profile
router.get('/me', authenticate, authController.getMe);

// Authenticated: Logout session
router.post('/logout', authenticate, authController.logout);

// Admin Only: Provision staff user
router.post(
  '/register-staff',
  authenticate,
  authorize([ROLES.ADMIN]),
  validate(registerUserSchema),
  authController.registerStaff
);

export default router;
