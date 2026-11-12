import { pool } from '../config/db.js';

export const reportService = {
  /**
   * System-wide high-level operational summary.
   */
  async getSummaryStats() {
    // 1. Total incidents and total fines
    const incidentsStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT i.id) AS total_incidents,
        COALESCE(SUM(io.fine_amount), 0) AS total_fines_amount,
        COUNT(DISTINCT i.plate_number) AS unique_vehicles_encountered
      FROM incidents i
      LEFT JOIN incident_offences io ON i.id = io.incident_id
    `);

    // 2. Incidents today & this month
    const timelineStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE incident_date >= CURRENT_DATE) AS incidents_today,
        COUNT(*) FILTER (WHERE incident_date >= date_trunc('month', CURRENT_DATE)) AS incidents_this_month,
        COUNT(*) FILTER (WHERE status = 'pending_correction') AS pending_corrections
      FROM incidents
    `);

    // 3. Active officers count
    const officerStats = await pool.query(`
      SELECT COUNT(*) AS active_officers 
      FROM profiles 
      WHERE role = 'agent' AND status = 'active'
    `);

    return {
      overview: {
        total_incidents: parseInt(incidentsStats.rows[0].total_incidents, 10),
        total_fines_amount: parseFloat(incidentsStats.rows[0].total_fines_amount),
        unique_vehicles_encountered: parseInt(incidentsStats.rows[0].unique_vehicles_encountered, 10),
        incidents_today: parseInt(timelineStats.rows[0].incidents_today, 10),
        incidents_this_month: parseInt(timelineStats.rows[0].incidents_this_month, 10),
        pending_corrections: parseInt(timelineStats.rows[0].pending_corrections, 10),
        active_officers: parseInt(officerStats.rows[0].active_officers, 10),
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
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows.map((row) => ({
      ...row,
      occurrence_count: parseInt(row.occurrence_count, 10),
      total_fine_generated: parseFloat(row.total_fine_generated),
    }));
  },

  /**
   * Officer performance metrics (Supervisors and Admins).
   */
  async getAgentPerformance({ startDate, endDate } = {}) {
    const conditions = [`p.role = 'agent'`];
    const params = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`i.incident_date >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`i.incident_date <= $${params.length}::timestamptz`);
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
    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      ...row,
      total_incidents_recorded: parseInt(row.total_incidents_recorded, 10),
      total_fines_levied: parseFloat(row.total_fines_levied),
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
      GROUP BY l.name, i.manual_location, l.area_or_zone
      ORDER BY violation_count DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows.map((row) => ({
      ...row,
      violation_count: parseInt(row.violation_count, 10),
      total_fines: parseFloat(row.total_fines),
    }));
  },
};
