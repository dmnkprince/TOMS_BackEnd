import pg from 'pg';
import { ENV } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: ENV.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('⚠️ Unexpected PostgreSQL client error on idle client:', err.message);
});

export const query = (text, params) => pool.query(text, params);
