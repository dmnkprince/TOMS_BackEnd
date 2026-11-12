import { createClient } from '@libsql/client';
import { ENV } from './env.js';

export const turso = createClient({
  url: ENV.TURSO_DATABASE_URL,
  authToken: ENV.TURSO_AUTH_TOKEN || undefined,
});

export const db = turso;
