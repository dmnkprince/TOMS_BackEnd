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

    // 0️⃣ Disable foreign‑key checks temporarily
    await turso.execute({ sql: 'PRAGMA foreign_keys = OFF;' });

    // 1️⃣ Rename old table
    await turso.execute({ sql: 'ALTER TABLE profiles RENAME TO profiles_old;' });

    // 2️⃣ Re‑create the table with the new CHECK constraint
    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
        await turso.execute({ sql: stmt + ';' });
      }
    }

    // 3️⃣ Copy data back
    await turso.execute({
      sql: `
        INSERT INTO profiles (id, full_name, badge_number, email, password_hash, role, phone_number, status, created_at, updated_at)
        SELECT id, full_name, badge_number, email, password_hash, role, phone_number, status, created_at, updated_at
        FROM profiles_old;
      `,
    });

    // 4️⃣ Drop the temporary table
    await turso.execute({ sql: 'DROP TABLE profiles_old;' });

    // 5️⃣ Re‑enable foreign‑key checks
    await turso.execute({ sql: 'PRAGMA foreign_keys = ON;' });

    console.log('✅ Migration applied safely (FKs preserved).');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();