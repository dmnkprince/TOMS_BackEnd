import { turso } from '../src/config/db.js';

(async () => {
  try {
    const result = await turso.execute({ sql: "PRAGMA table_info('profiles');" });
    console.log('Table info:', result.rows);
    const check = await turso.execute({ sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='profiles';" });
    console.log('Create statement:', check.rows[0].sql);
  } catch (err) {
    console.error('Error checking schema:', err);
  }
})();
