// src/routes/pushRoutes.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  sendPush,
} from '../controllers/pushController.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Public: get the VAPID public key (needed before auth to set up SW)
router.get('/vapid-public-key', getVapidPublicKey);

// Authenticated: manage subscriptions
router.post('/subscribe', authenticate, subscribe);
router.delete('/unsubscribe', authenticate, unsubscribe);

// Admin/Supervisor only: send push notifications
router.post('/send', authenticate, authorize([ROLES.ADMIN, ROLES.SUPERVISOR]), sendPush);

export default router;
