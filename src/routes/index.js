import { Router } from 'express';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import vehicleRoutes from './vehicleRoutes.js';
import incidentRoutes from './incidentRoutes.js';
import correctionRoutes from './correctionRoutes.js';
import offenceRoutes from './offenceRoutes.js';
import locationRoutes from './locationRoutes.js';
import reportRoutes from './reportRoutes.js';
import auditLogRoutes from './auditLogRoutes.js';
import { pool } from '../config/db.js';

const router = Router();

// Health Check Endpoint
router.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = `unreachable (${err.message})`;
  }

  return res.status(200).json({
    status: 'ok',
    system: 'Traffic Offence Management System (TOMS) API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Mount Modules
router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/incidents', incidentRoutes);
router.use('/corrections', correctionRoutes);
router.use('/offence-types', offenceRoutes);
router.use('/locations', locationRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditLogRoutes);

export default router;
