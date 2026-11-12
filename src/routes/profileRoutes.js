import { Router } from 'express';
import { profileController } from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema, updateRoleSchema } from '../validators/authValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Supervisors and Admins: List profiles
router.get('/', authenticate, authorize([ROLES.SUPERVISOR, ROLES.ADMIN]), profileController.getProfiles);

// Authenticated: Get profile by ID
router.get('/:id', authenticate, profileController.getProfile);

// Self or Admin: Update profile info
router.patch('/:id', authenticate, validate(updateProfileSchema), profileController.updateProfile);

// Admin Only: Change staff role or status
router.patch(
  '/:id/role',
  authenticate,
  authorize([ROLES.ADMIN]),
  validate(updateRoleSchema),
  profileController.updateRoleAndStatus
);

export default router;
