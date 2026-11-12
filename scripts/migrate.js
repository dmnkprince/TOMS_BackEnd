import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not defined in .env file.');
  process.exit(1);
}

const sqlFiles = [
  '01_schema.sql',
  '02_indexes.sql',
  '03_rpc_transactions.sql',
  '04_rls_policies.sql',
  '05_seed_data.sql',
];

async function runMigrations() {
  console.log('🚀 Starting TOMS database migration...');
  console.log(`📡 Connecting to PostgreSQL at: ${connectionString.split('@')[1] || 'remote'}`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to Supabase PostgreSQL database.');

    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, '..', 'sql', file);
      console.log(`📄 Executing ${file}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      await client.query(sqlContent);
      console.log(`✅ Finished ${file}`);
    }

    console.log('🎉 All migrations and seed data executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
