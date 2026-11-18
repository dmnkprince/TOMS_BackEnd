import { turso } from '../config/db.js';

export async function initPasswordRequestsTable() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS password_requests (
        id TEXT PRIMARY KEY,
        officer_name TEXT,
        badge_number TEXT,
        email TEXT NOT NULL,
        requested_password TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        requested_at TEXT,
        approved_by TEXT,
        approved_at TEXT,
        rejection_reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if empty, seed only once if table has 0 rows
    const countRes = await turso.execute('SELECT COUNT(*) as cnt FROM password_requests');
    const count = countRes.rows[0]?.cnt || 0;

    if (count === 0) {
      const initial = [
        {
          id: 'req-001',
          officer_name: 'Officer David Okafor',
          badge_number: 'AGT-101',
          email: 'officer.david@toms.gov',
          requested_password: 'Password2026!',
          reason: 'Periodic mandatory credentials change',
          status: 'pending',
          requested_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        },
        {
          id: 'req-002',
          officer_name: 'Officer Aisha Bello',
          badge_number: 'AGT-102',
          email: 'officer.aisha@toms.gov',
          requested_password: 'SecurePass2026!',
          reason: 'Password reset request after device re-assignment',
          status: 'pending',
          requested_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
        },
      ];

      for (const item of initial) {
        await turso.execute({
          sql: `
            INSERT INTO password_requests (id, officer_name, badge_number, email, requested_password, reason, status, requested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            item.id,
            item.officer_name,
            item.badge_number,
            item.email,
            item.requested_password,
            item.reason,
            item.status,
            item.requested_at,
          ],
        });
      }
      console.log('Seeded initial password_requests into Turso DB.');
    }
    console.log('password_requests table is ready in Turso.');
  } catch (err) {
    console.error('Failed to init password_requests table:', err);
  }
}
