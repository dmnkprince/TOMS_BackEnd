import { Router } from 'express';
import { locationController } from '../controllers/locationController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createLocationSchema, updateLocationSchema } from '../validators/locationValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Authenticated: List locations
router.get('/', authenticate, locationController.getLocations);

// Authenticated: Get location by ID
router.get('/:id', authenticate, locationController.getLocationById);

// Supervisors & Admins: Create location
router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(createLocationSchema),
  locationController.createLocation
);

// Supervisors & Admins: Update location
router.patch(
  '/:id',
  authenticate,
  authorize([ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(updateLocationSchema),
  locationController.updateLocation
);

export default router;
