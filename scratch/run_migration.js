import { turso } from '../src/config/db.js';
import { readFileSync } from 'fs';

(async () => {
  try {
    const sql = readFileSync('../src/db/migrate_add_field_agent_role.sql', 'utf8');
    await turso.execute({ sql });
    console.log('✅ Migration applied: field_agent role now allowed');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();
