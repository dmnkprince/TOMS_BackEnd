import { turso } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const NEW_PASSWORD = 'Password123!'; // uniform password for every user

(async () => {
  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 10);
    const result = await turso.execute({
      sql: `UPDATE profiles SET password_hash = ?`,
      args: [hash],
    });
    console.log(`✅ Updated password for all users to "${NEW_PASSWORD}"`);
    console.log('Rows affected:', result.changes?.changedRows ?? 'unknown');
  } catch (err) {
    console.error('❌ Password reset failed:', err);
    process.exit(1);
  }
})();
