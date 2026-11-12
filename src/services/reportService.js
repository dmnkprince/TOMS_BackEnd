import { turso } from '../config/db.js';

export const reportService = {
  /**
   * System-wide high-level operational summary.
   */
  async getSummaryStats() {
    // 1. Total incidents and total fines
    const incidentsStats = await turso.execute(`
      SELECT 
        COUNT(DISTINCT i.id) AS total_incidents,
        COALESCE(SUM(io.fine_amount), 0) AS total_fines_amount,
        COUNT(DISTINCT i.plate_number) AS unique_vehicles_encountered
      FROM incidents i
      LEFT JOIN incident_offences io ON i.id = io.incident_id
    `);

    // 2. Incidents today & this month
    const timelineStats = await turso.execute(`
      SELECT
        COUNT(CASE WHEN date(incident_date) = date('now') THEN 1 END) AS incidents_today,
        COUNT(CASE WHEN strftime('%Y-%m', incident_date) = strftime('%Y-%m', 'now') THEN 1 END) AS incidents_this_month,
        COUNT(CASE WHEN status = 'pending_correction' THEN 1 END) AS pending_corrections
      FROM incidents
    `);

    // 3. Active officers count
    const officerStats = await turso.execute(`
      SELECT COUNT(*) AS active_officers 
      FROM profiles 
      WHERE role = 'agent' AND status = 'active'
    `);

    return {
      overview: {
        total_incidents: Number(incidentsStats.rows[0].total_incidents),
        total_fines_amount: Number(incidentsStats.rows[0].total_fines_amount),
        unique_vehicles_encountered: Number(incidentsStats.rows[0].unique_vehicles_encountered),
        incidents_today: Number(timelineStats.rows[0].incidents_today),
        incidents_this_month: Number(timelineStats.rows[0].incidents_this_month),
        pending_corrections: Number(timelineStats.rows[0].pending_corrections),
        active_officers: Number(officerStats.rows[0].active_officers),
      },
    };
  },

  /**
   * Top offences ranked by frequency and fines.
   */
  async getTopOffences(limit = 10) {
    const query = `
      SELECT 
        ot.id,
        ot.code,
        ot.title,
        ot.category,
        COUNT(io.id) AS occurrence_count,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_generated
      FROM offence_types ot
      JOIN incident_offences io ON ot.id = io.offence_type_id
      GROUP BY ot.id, ot.code, ot.title, ot.category
      ORDER BY occurrence_count DESC
      LIMIT ?
    `;
    const result = await turso.execute({ sql: query, args: [limit] });
    return result.rows.map((row) => ({
      ...row,
      occurrence_count: Number(row.occurrence_count),
      total_fine_generated: Number(row.total_fine_generated),
    }));
  },

  /**
   * Officer performance metrics (Supervisors and Admins).
   */
  async getAgentPerformance({ startDate, endDate } = {}) {
    const conditions = ["p.role = 'agent'"];
    const args = [];

    if (startDate) {
      conditions.push('i.incident_date >= ?');
      args.push(startDate);
    }
    if (endDate) {
      conditions.push('i.incident_date <= ?');
      args.push(endDate);
    }

    const query = `
      SELECT 
        p.id AS agent_id,
        p.full_name,
        p.badge_number,
        p.status,
        COUNT(DISTINCT i.id) AS total_incidents_recorded,
        COALESCE(SUM(io.fine_amount), 0) AS total_fines_levied,
        MAX(i.incident_date) AS last_activity_timestamp
      FROM profiles p
      LEFT JOIN incidents i ON p.id = i.agent_id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.id, p.full_name, p.badge_number, p.status
      ORDER BY total_incidents_recorded DESC
    `;
    const result = await turso.execute({ sql: query, args });
    return result.rows.map((row) => ({
      ...row,
      total_incidents_recorded: Number(row.total_incidents_recorded),
      total_fines_levied: Number(row.total_fines_levied),
    }));
  },

  /**
   * Violation hotspots by location.
   */
  async getLocationHotspots(limit = 10) {
    const query = `
      SELECT 
        COALESCE(l.name, i.manual_location, 'Unspecified Location') AS location_name,
        COALESCE(l.area_or_zone, 'Custom Zone') AS zone,
        COUNT(i.id) AS violation_count,
        COALESCE(SUM(io.fine_amount), 0) AS total_fines
      FROM incidents i
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      GROUP BY location_name, zone
      ORDER BY violation_count DESC
      LIMIT ?
    `;
    const result = await turso.execute({ sql: query, args: [limit] });
    return result.rows.map((row) => ({
      ...row,
      violation_count: Number(row.violation_count),
      total_fines: Number(row.total_fines),
    }));
  },
};
