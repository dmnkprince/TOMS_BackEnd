import { Router } from 'express';
import { auditLogController } from '../controllers/auditLogController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Supervisors and Admins Only: Immutable audit trails
router.get('/', authenticate, authorize([ROLES.SUPERVISOR, ROLES.ADMIN]), auditLogController.getLogs);

export default router;
