import { Router } from 'express';
import { correctionController } from '../controllers/correctionController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createCorrectionSchema, reviewCorrectionSchema } from '../validators/correctionValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Agents, Supervisors, Admins: Submit a correction request
router.post(
  '/',
  authenticate,
  authorize([ROLES.AGENT, ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(createCorrectionSchema),
  correctionController.submitRequest
);

// Authenticated: List correction requests (filtered by agent role automatically)
router.get('/', authenticate, correctionController.getRequests);

// Authenticated: Get single correction request with comparison
router.get('/:id', authenticate, correctionController.getRequestById);

// Supervisors and Admins Only: Approve or Reject correction request
router.patch(
  '/:id/review',
  authenticate,
  authorize([ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(reviewCorrectionSchema),
  correctionController.reviewRequest
);

export default router;
