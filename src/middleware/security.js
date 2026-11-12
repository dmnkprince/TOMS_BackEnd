import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import { ENV } from '../config/env.js';

/**
 * Enhanced Helmet configuration enforcing strict security headers.
 */
export const helmetSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ENV.TURSO_DATABASE_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' }, // Clickjacking protection
  hidePoweredBy: true, // Strips X-Powered-By header
  hsts: {
    maxAge: 31536000, // 1 year Strict-Transport-Security
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true, // X-Content-Type-Options: nosniff
  originAgentCluster: true,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true, // X-XSS-Protection
});

/**
 * Hardened CORS policy.
 */
export const corsSecurity = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) in non-production
    if (!origin || ENV.CORS_ORIGIN === '*') {
      return callback(null, true);
    }
    const allowedOrigins = ENV.CORS_ORIGIN.split(',').map((o) => o.trim());
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy: Origin not allowed.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  credentials: true,
  maxAge: 86400, // 24 hours preflight caching
});

/**
 * HTTP Parameter Pollution (HPP) protection.
 */
export const hppSecurity = hpp({
  // Whitelist query parameters that are allowed to have multiple values
  whitelist: ['category', 'status'],
});

/**
 * Deep recursive request sanitizer.
 * Cleans Prototype Pollution (`__proto__`, `constructor`, `prototype`) and null bytes (`\0`).
 */
export const sanitizeRequest = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    for (const key of Object.keys(obj)) {
      // Prototype Pollution Prevention
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        delete obj[key];
        continue;
      }

      if (typeof obj[key] === 'string') {
        // Remove null-bytes
        obj[key] = obj[key].replace(/\0/g, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

/**
 * Prevents intermediate caches and browsers from caching sensitive enforcement records.
 */
export const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};
