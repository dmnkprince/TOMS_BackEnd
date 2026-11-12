import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'file:toms.db',
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || '',
  JWT_SECRET: process.env.JWT_SECRET || 'toms_default_jwt_secret_dev_only',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};
