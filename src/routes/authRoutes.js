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

// Submit Password Change Request (Public or Authenticated)
router.post('/password-change-request', authController.requestPasswordChange);

// Admin Only: Get all pending/historical password change requests
router.get(
  '/password-requests',
  authenticate,
  authorize([ROLES.ADMIN]),
  authController.getPasswordRequests
);

// Admin Only: Approve password change request
router.post(
  '/password-requests/:id/approve',
  authenticate,
  authorize([ROLES.ADMIN]),
  authController.approvePasswordRequest
);

// Admin Only: Reject password change request
router.post(
  '/password-requests/:id/reject',
  authenticate,
  authorize([ROLES.ADMIN]),
  authController.rejectPasswordRequest
);

export default router;
