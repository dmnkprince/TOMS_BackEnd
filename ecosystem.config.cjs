// ecosystem.config.cjs
// PM2 Process Manager Configuration for Enterprise Production Deployments

module.exports = {
  apps: [
    {
      name: 'toms-backend',
      script: './src/server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      exp_backoff_restart_delay: 100,
      listen_timeout: 8000,
      kill_timeout: 5000,
    },
  ],
};
