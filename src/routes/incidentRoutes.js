import { Router } from 'express';
import { incidentController } from '../controllers/incidentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { registerIncidentSchema, incidentSearchQuerySchema } from '../validators/incidentValidator.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Agents, Supervisors, Admins: Register new incident (atomically records offences)
router.post(
  '/',
  authenticate,
  authorize([ROLES.AGENT, ROLES.SUPERVISOR, ROLES.ADMIN]),
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

export default router;
