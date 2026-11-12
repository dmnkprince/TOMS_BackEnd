import app from './app.js';
import { ENV } from './config/env.js';
import { pool } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = ENV.PORT || 5000;

const server = app.listen(PORT, async () => {
  logger.info(`=======================================================`);
  logger.info(`🚦 TOMS Backend Server running on port ${PORT}`);
  logger.info(`🌐 Environment: ${ENV.NODE_ENV}`);
  logger.info(`📡 API Base: http://localhost:${PORT}/api/v1`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/api/v1/health`);
  logger.info(`=======================================================`);

  // Verify PostgreSQL Connectivity
  try {
    const res = await pool.query('SELECT NOW()');
    logger.info(`✅ PostgreSQL Database Connected: ${res.rows[0].now}`);
  } catch (err) {
    logger.warn(`⚠️ PostgreSQL connection warning: ${err.message}`);
    logger.warn(`👉 Make sure SQL scripts in sql/ are executed in Supabase SQL editor.`);
  }
});

// Graceful Shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('Database pool closed.');
    } catch (err) {
      logger.error('Error closing database pool:', err.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
