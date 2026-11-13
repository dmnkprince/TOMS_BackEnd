import { Router } from 'express';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import incidentRoutes from './incidentRoutes.js';
import correctionRoutes from './correctionRoutes.js';
import locationRoutes from './locationRoutes.js';
import reportRoutes from './reportRoutes.js';
import { turso } from '../config/db.js';

const router = Router();

// Health Check Endpoint
router.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await turso.execute('SELECT 1');
  } catch (err) {
    dbStatus = `unreachable (${err.message})`;
  }

  return res.status(200).json({
    status: 'ok',
    system: 'Traffic Offence Management System (TOMS) API',
    database_engine: 'Turso (libSQL / SQLite)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Mount Modules
router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes);
router.use('/incidents', incidentRoutes);
router.use('/corrections', correctionRoutes);
router.use('/locations', locationRoutes);
router.use('/reports', reportRoutes);

export default router;
