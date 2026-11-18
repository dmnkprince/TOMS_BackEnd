import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// List users (admin / supervisor)
router.get(
  '/',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.SUPERVISOR]),
  authController.getUsers
);

// Update a user (admin / supervisor)
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.SUPERVISOR]),
  authController.updateUser
);

// Delete a user (admin / supervisor)
router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.SUPERVISOR]),
  authController.deleteUser
);

export default router;
