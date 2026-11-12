import { Router } from 'express';
import { vehicleLookupController } from '../controllers/vehicleLookupController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Authenticated: Lookup vehicle previous snapshot by plate number
router.get('/lookup/:plateNumber', authenticate, vehicleLookupController.lookupByPlate);

export default router;
