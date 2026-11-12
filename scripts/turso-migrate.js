import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { turso } from '../src/config/db.js';
import { ENV } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTursoMigrations() {
  console.log('🚀 Starting TOMS Turso database migration...');
  console.log(`📡 Connecting to: ${ENV.TURSO_DATABASE_URL}`);

  try {
    // 1. Execute Schema
    const schemaPath = path.join(__dirname, '..', 'sql', 'turso_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    console.log('📄 Executing turso_schema.sql...');
    await turso.executeMultiple(schemaSql);
    console.log('✅ turso_schema.sql applied successfully!');

    // 2. Execute Seed Data
    const seedPath = path.join(__dirname, '..', 'sql', 'turso_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf-8');
    console.log('🌱 Executing turso_seed.sql...');
    await turso.executeMultiple(seedSql);
    console.log('✅ turso_seed.sql applied successfully!');

    // Verify
    const checkProfiles = await turso.execute('SELECT COUNT(*) AS count FROM profiles');
    const checkOffences = await turso.execute('SELECT COUNT(*) AS count FROM offence_types');
    const checkLocations = await turso.execute('SELECT COUNT(*) AS count FROM locations');

    console.log('=======================================================');
    console.log(`🎉 Migration Completed!`);
    console.log(`👤 Profiles in DB:     ${checkProfiles.rows[0].count}`);
    console.log(`⚖️ Offence types in DB: ${checkOffences.rows[0].count}`);
    console.log(`📍 Locations in DB:    ${checkLocations.rows[0].count}`);
    console.log('=======================================================');
  } catch (error) {
    console.error('❌ Turso migration failed:', error.message);
    process.exit(1);
  }
}

runTursoMigrations();
