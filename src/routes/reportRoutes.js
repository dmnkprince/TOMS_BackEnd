import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Supervisors and Admins Only: Statistical and performance reports
router.get('/summary', authenticate, authorize([ROLES.SUPERVISOR, ROLES.ADMIN]), reportController.getSummary);
router.get('/top-offences', authenticate, authorize([ROLES.SUPERVISOR, ROLES.ADMIN]), reportController.getTopOffences);
router.get('/agent-performance', authenticate, authorize([ROLES.SUPERVISOR, ROLES.ADMIN]), reportController.getAgentPerformance);
router.get('/location-hotspots', authenticate, authorize([ROLES.SUPERVISOR, ROLES.ADMIN]), reportController.getLocationHotspots);

export default router;
