import { turso } from '../src/config/db.js';
import { readFileSync } from 'fs';

(async () => {
  try {
    const sql = readFileSync('../src/db/migrate_add_field_agent_role.sql', 'utf8');
    // Split statements on semicolons, keep non‑empty trimmed parts
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await turso.execute({ sql: stmt + ';' });
    }
    console.log('✅ Migration applied (split statements)');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();