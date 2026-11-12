import app from './app.js';
import { ENV } from './config/env.js';
import { turso } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = ENV.PORT || 5000;

const server = app.listen(PORT, async () => {
  logger.info(`=======================================================`);
  logger.info(`🚦 TOMS Backend Server running on port ${PORT}`);
  logger.info(`🌐 Environment: ${ENV.NODE_ENV}`);
  logger.info(`📡 API Base: http://localhost:${PORT}/api/v1`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/api/v1/health`);
  logger.info(`=======================================================`);

  // Verify Turso Connectivity
  try {
    const res = await turso.execute("SELECT datetime('now') AS now");
    logger.info(`✅ Turso Database Connected: ${res.rows[0].now}`);
  } catch (err) {
    logger.warn(`⚠️ Turso connection warning: ${err.message}`);
  }
});

// Graceful Shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await turso.close();
      logger.info('Turso connection closed.');
    } catch (err) {
      logger.error('Error closing Turso client:', err.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
