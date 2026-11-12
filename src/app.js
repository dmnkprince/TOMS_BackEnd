import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN.split(','),
  credentials: true,
}));

// Request Logging
if (ENV.NODE_ENV !== 'test') {
  app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiting
app.use('/api/', apiLimiter);

// API Version 1 Routes
app.use('/api/v1', apiRouter);

// Welcome Root Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to TOMS (Traffic Offence Management System) REST API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route '${req.method} ${req.originalUrl}' was not found on this server.`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
