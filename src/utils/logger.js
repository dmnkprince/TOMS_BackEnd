export const logger = {
  info: (msg, meta = '') => console.log(`[INFO]  [${new Date().toISOString()}] ${msg}`, meta ? meta : ''),
  warn: (msg, meta = '') => console.warn(`[WARN]  [${new Date().toISOString()}] ${msg}`, meta ? meta : ''),
  error: (msg, meta = '') => console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, meta ? meta : ''),
  debug: (msg, meta = '') => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${msg}`, meta ? meta : '');
    }
  },
};
