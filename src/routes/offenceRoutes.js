import { Router } from 'express';
import { offenceController } from '../controllers/offenceController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createOffenceSchema, updateOffenceSchema } from '../validators/offenceValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Authenticated: List offence types (active or all)
router.get('/', authenticate, offenceController.getOffences);

// Authenticated: Get offence type by ID
router.get('/:id', authenticate, offenceController.getOffenceById);

// Admin Only: Create new offence type
router.post(
  '/',
  authenticate,
  authorize([ROLES.ADMIN]),
  validate(createOffenceSchema),
  offenceController.createOffence
);

// Admin Only: Update offence type
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.ADMIN]),
  validate(updateOffenceSchema),
  offenceController.updateOffence
);

// Admin Only: Toggle active status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize([ROLES.ADMIN]),
  offenceController.toggleStatus
);

export default router;
