import { turso } from '../src/config/db.js';
import { readFile } from 'fs/promises';

(async () => {
  try {
    const sql = await readFile('src/db/add_password_change_approved.sql', 'utf8');
    await turso.execute({ sql });
    console.log('Migration applied: password_change_approved column added');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
