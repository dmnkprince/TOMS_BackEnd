import { pool } from '../config/db.js';
import { generateReferenceNumber } from '../utils/referenceGenerator.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

export const incidentService = {
  /**
   * Atomically registers an incident with one or more offences and an audit log.
   */
  async registerIncident(incidentData, agentId, ipAddress = null) {
    const {
      plate_number,
      body_number,
      vehicle_make,
      vehicle_model,
      vehicle_color,
      vehicle_type,
      vehicle_owner_name,
      vehicle_owner_phone,
      driver_license_number,
      driver_name,
      location_id,
      manual_location,
      location_description,
      incident_date,
      remarks,
      offences,
    } = incidentData;

    if (!offences || offences.length === 0) {
      const error = new Error('An incident must contain at least one offence.');
      error.statusCode = 400;
      throw error;
    }

    const client = await pool.connect();
    const referenceNumber = generateReferenceNumber();

    try {
      await client.query('BEGIN');

      // 1. Insert Incident Record
      const insertIncidentQuery = `
        INSERT INTO incidents (
          reference_number,
          agent_id,
          incident_date,
          location_id,
          manual_location,
          location_description,
          plate_number,
          body_number,
          vehicle_make,
          vehicle_model,
          vehicle_color,
          vehicle_type,
          vehicle_owner_name,
          vehicle_owner_phone,
          driver_license_number,
          driver_name,
          remarks,
          status
        ) VALUES (
          $1, $2, COALESCE($3::timestamptz, NOW()), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'recorded'
        )
        RETURNING *
      `;

      const incidentResult = await client.query(insertIncidentQuery, [
        referenceNumber,
        agentId,
        incident_date || null,
        location_id || null,
        manual_location || null,
        location_description || null,
        plate_number.trim().toUpperCase(),
        body_number ? body_number.trim() : null,
        vehicle_make.trim(),
        vehicle_model.trim(),
        vehicle_color.trim(),
        vehicle_type.trim(),
        vehicle_owner_name ? vehicle_owner_name.trim() : null,
        vehicle_owner_phone ? vehicle_owner_phone.trim() : null,
        driver_license_number ? driver_license_number.trim() : null,
        driver_name ? driver_name.trim() : null,
        remarks || null,
      ]);

      const createdIncident = incidentResult.rows[0];

      // 2. Insert Associated Offences
      const insertedOffences = [];
      for (const item of offences) {
        // If fine_amount not provided in payload, look up default penalty from offence_types
        let fine = item.fine_amount;
        if (fine === undefined || fine === null) {
          const defaultPenaltyRes = await client.query(
            `SELECT penalty_amount FROM offence_types WHERE id = $1`,
            [item.offence_type_id]
          );
          fine = defaultPenaltyRes.rows[0]?.penalty_amount || 0.00;
        }

        const insertOffenceQuery = `
          INSERT INTO incident_offences (incident_id, offence_type_id, fine_amount, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const offenceRes = await client.query(insertOffenceQuery, [
          createdIncident.id,
          item.offence_type_id,
          fine,
          item.notes || null,
        ]);
        insertedOffences.push(offenceRes.rows[0]);
      }

      // 3. Write Immutable Audit Log
      const auditQuery = `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await client.query(auditQuery, [
        agentId,
        AUDIT_ACTIONS.INCIDENT_CREATED,
        'incidents',
        createdIncident.id,
        JSON.stringify({
          reference_number: referenceNumber,
          plate_number: createdIncident.plate_number,
          offences_count: insertedOffences.length,
        }),
        ipAddress,
      ]);

      await client.query('COMMIT');

      return {
        ...createdIncident,
        offences: insertedOffences,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Advanced Multi-Filter Search with Pagination and Deduplication.
   */
  async searchIncidents(filters = {}) {
    const {
      plate_number,
      body_number,
      start_date,
      end_date,
      vehicle_type,
      vehicle_make,
      vehicle_model,
      category,
      agent_id,
      location_id,
      reference_number,
      page = 1,
      limit = 20,
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (reference_number) {
      params.push(`%${reference_number.trim()}%`);
      conditions.push(`i.reference_number ILIKE $${params.length}`);
    }

    if (plate_number) {
      params.push(`%${plate_number.trim().toUpperCase()}%`);
      conditions.push(`i.plate_number ILIKE $${params.length}`);
    }

    if (body_number) {
      params.push(`%${body_number.trim()}%`);
      conditions.push(`i.body_number ILIKE $${params.length}`);
    }

    if (vehicle_type) {
      params.push(vehicle_type.trim());
      conditions.push(`i.vehicle_type ILIKE $${params.length}`);
    }

    if (vehicle_make) {
      params.push(`%${vehicle_make.trim()}%`);
      conditions.push(`i.vehicle_make ILIKE $${params.length}`);
    }

    if (vehicle_model) {
      params.push(`%${vehicle_model.trim()}%`);
      conditions.push(`i.vehicle_model ILIKE $${params.length}`);
    }

    if (agent_id) {
      params.push(agent_id);
      conditions.push(`i.agent_id = $${params.length}`);
    }

    if (location_id) {
      params.push(location_id);
      conditions.push(`i.location_id = $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      conditions.push(`i.incident_date >= $${params.length}::timestamptz`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`i.incident_date <= $${params.length}::timestamptz`);
    }

    // Filter by offence category without duplicating incident rows
    if (category) {
      params.push(`%${category.trim()}%`);
      conditions.push(`EXISTS (
        SELECT 1 
        FROM incident_offences io
        JOIN offence_types ot ON io.offence_type_id = ot.id
        WHERE io.incident_id = i.id AND ot.category ILIKE $${params.length}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count
    const countQuery = `
      SELECT COUNT(DISTINCT i.id) AS total
      FROM incidents i
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Paginated Incidents with Aggregated Offences
    params.push(limit);
    params.push(offset);

    const query = `
      SELECT 
        i.*,
        p.full_name AS agent_name,
        p.badge_number AS agent_badge,
        l.name AS predefined_location_name,
        l.code AS predefined_location_code,
        COALESCE(
          json_agg(
            json_build_object(
              'id', io.id,
              'offence_type_id', ot.id,
              'title', ot.title,
              'code', ot.code,
              'category', ot.category,
              'fine_amount', io.fine_amount,
              'notes', io.notes
            )
          ) FILTER (WHERE io.id IS NOT NULL),
          '[]'
        ) AS offences,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_amount
      FROM incidents i
      LEFT JOIN profiles p ON i.agent_id = p.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
      ${whereClause}
      GROUP BY i.id, p.full_name, p.badge_number, l.name, l.code
      ORDER BY i.incident_date DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(query, params);

    return {
      incidents: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Retrieves single incident details by ID.
   */
  async getIncidentById(incidentId) {
    const query = `
      SELECT 
        i.*,
        p.full_name AS agent_name,
        p.badge_number AS agent_badge,
        p.email AS agent_email,
        l.name AS predefined_location_name,
        l.code AS predefined_location_code,
        l.area_or_zone,
        COALESCE(
          json_agg(
            json_build_object(
              'id', io.id,
              'offence_type_id', ot.id,
              'title', ot.title,
              'code', ot.code,
              'category', ot.category,
              'fine_amount', io.fine_amount,
              'demerit_points', ot.demerit_points,
              'notes', io.notes
            )
          ) FILTER (WHERE io.id IS NOT NULL),
          '[]'
        ) AS offences,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_amount
      FROM incidents i
      LEFT JOIN profiles p ON i.agent_id = p.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
      WHERE i.id = $1
      GROUP BY i.id, p.full_name, p.badge_number, p.email, l.name, l.code, l.area_or_zone
    `;
    const result = await pool.query(query, [incidentId]);

    if (result.rows.length === 0) {
      const error = new Error('Incident record not found.');
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  },

  /**
   * Retrieves single incident by Reference Number.
   */
  async getIncidentByReference(referenceNumber) {
    const query = `
      SELECT 
        i.*,
        p.full_name AS agent_name,
        p.badge_number AS agent_badge,
        l.name AS predefined_location_name,
        l.code AS predefined_location_code,
        COALESCE(
          json_agg(
            json_build_object(
              'id', io.id,
              'offence_type_id', ot.id,
              'title', ot.title,
              'code', ot.code,
              'category', ot.category,
              'fine_amount', io.fine_amount,
              'notes', io.notes
            )
          ) FILTER (WHERE io.id IS NOT NULL),
          '[]'
        ) AS offences,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_amount
      FROM incidents i
      LEFT JOIN profiles p ON i.agent_id = p.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
      WHERE UPPER(i.reference_number) = UPPER($1)
      GROUP BY i.id, p.full_name, p.badge_number, l.name, l.code
    `;
    const result = await pool.query(query, [referenceNumber]);

    if (result.rows.length === 0) {
      const error = new Error(`Incident with reference ${referenceNumber} not found.`);
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  },
};
