import { turso } from '../src/config/db.js';
import { readFileSync } from 'fs';
import path from 'path';

(async () => {
  try {
    const migrationPath = path.resolve('src/db/migrate_add_field_agent_role.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Split on semicolons, ignore empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await turso.execute({ sql: stmt + ';' });
    }

    console.log('✅ Migration applied (absolute path)');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();