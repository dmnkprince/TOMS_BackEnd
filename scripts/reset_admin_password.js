import { turso } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

const NEW_PASSWORD = 'admin123'; // change as needed
const TARGET_EMAIL = 'admin@toms.gov'; // user to reset

(async () => {
  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 10);
    await turso.execute({
      sql: `UPDATE profiles SET password_hash = ? WHERE email = ?`,
      args: [hash, TARGET_EMAIL],
    });
    console.log(`Password for ${TARGET_EMAIL} reset to '${NEW_PASSWORD}'.`);
  } catch (err) {
    console.error('Password reset failed:', err);
    process.exit(1);
  }
})();
