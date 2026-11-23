import { Router } from 'express';
import { incidentController } from '../controllers/incidentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  registerIncidentSchema,
  incidentSearchQuerySchema,
  updateIncidentSchema,
} from '../validators/incidentValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Agents, Field Agents, Supervisors, Admins: Register new incident (atomically records offences)
router.post(
  '/',
  authenticate,
  authorize([ROLES.AGENT, ROLES.FIELD_AGENT, ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(registerIncidentSchema),
  incidentController.registerIncident
);

// Authenticated: Advanced Multi-Filter Search with Pagination
router.get(
  '/',
  authenticate,
  validate(incidentSearchQuerySchema, 'query'),
  incidentController.searchIncidents
);

// Authenticated: Retrieve by Reference Number
router.get('/ref/:referenceNumber', authenticate, incidentController.getIncidentByReference);

// Authenticated: Retrieve by ID
router.get('/:id', authenticate, incidentController.getIncidentById);

// Supervisors and Admins Only: Update / Edit Incident Record
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(updateIncidentSchema),
  incidentController.updateIncident
);

router.patch(
  '/:id',
  authenticate,
  authorize([ROLES.SUPERVISOR, ROLES.ADMIN]),
  validate(updateIncidentSchema),
  incidentController.updateIncident
);

// Supervisors and Admins Only: Delete Incident Record
router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPERVISOR, ROLES.ADMIN]),
  incidentController.deleteIncident
);

export default router;
