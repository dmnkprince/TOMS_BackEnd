// src/cluster.js
// Native Node.js cluster supervisor for multi-core scalability
import cluster from 'node:cluster';
import os from 'node:os';
import { logger } from './utils/logger.js';

const numCPUs = parseInt(process.env.WEB_CONCURRENCY, 10) || os.cpus().length || 1;

if (cluster.isPrimary) {
  logger.info(`=======================================================`);
  logger.info(`🚀 Primary Cluster Manager [PID: ${process.pid}]`);
  logger.info(`⚡ CPU Cores Detected: ${numCPUs}`);
  logger.info(`🔄 Forking ${numCPUs} worker processes...`);
  logger.info(`=======================================================`);

  // Track workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit & auto-restart
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`⚠️ Worker [PID: ${worker.process.pid}] exited (code: ${code}, signal: ${signal}).`);
    // Avoid rapid restart storm if process was intentionally terminated
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      logger.info('🔄 Spawning replacement worker process...');
      setTimeout(() => cluster.fork(), 1000);
    }
  });

  // Relay signals to workers
  const handleSignal = (sig) => {
    logger.info(`Primary received ${sig}. Gracefully notifying all workers...`);
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill(sig);
    }
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
} else {
  // Worker process runs the Express server
  import('./server.js')
    .then(() => {
      logger.info(`👷 Worker [PID: ${process.pid}] online and serving requests.`);
    })
    .catch((err) => {
      logger.error(`❌ Worker failed to start: ${err.message}`, err);
      process.exit(1);
    });
}
