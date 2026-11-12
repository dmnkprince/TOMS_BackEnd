import express from 'express';
import morgan from 'morgan';
import { ENV } from './config/env.js';
import {
  helmetSecurity,
  corsSecurity,
  hppSecurity,
  sanitizeRequest,
  noCache,
} from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

const app = express();

// Disable x-powered-by header (defense-in-depth)
app.disable('x-powered-by');

// 1. Enhanced Helmet Security Headers
app.use(helmetSecurity);

// 2. Hardened CORS Configuration
app.use(corsSecurity);

// 3. Request Logging
if (ENV.NODE_ENV !== 'test') {
  app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 4. Body Parsers with Controlled Payload Size Limits (DoS Mitigation)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. HTTP Parameter Pollution Protection
app.use(hppSecurity);

// 6. Deep Request Sanitizer (Anti-Prototype Pollution & Null-Byte cleansing)
app.use(sanitizeRequest);

// 7. Global API Rate Limiting (DDoS & Brute Force Mitigation)
app.use('/api/', apiLimiter);

// 8. Mount Versioned Routes with Anti-Caching on Sensitive Data
app.use('/api/v1', noCache, apiRouter);

// 9. Root Welcome Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to TOMS (Traffic Offence Management System) REST API',
    security: 'Enforced (Helmet, CORS, HPP, Anti-Pollution, Rate-Limiting, No-Cache)',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// 10. 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route '${req.method} ${req.originalUrl}' was not found on this server.`,
  });
});

// 11. Centralized Error Handling Middleware (Catches and masks errors)
app.use(errorHandler);

export default app;
