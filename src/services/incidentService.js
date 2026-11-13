import crypto from 'crypto';
import { turso } from '../config/db.js';
import { generateReferenceNumber } from '../utils/referenceGenerator.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

export const incidentService = {
  /**
   * Atomically registers an incident with one or more offences and an audit log in Turso.
   */
  async registerIncident(incidentData, agentId, ipAddress = null) {
    const plate = (incidentData.plate_number || incidentData.vehiclePlate || '').trim().toUpperCase();
    const vType = (incidentData.vehicle_type || incidentData.vehicleType || 'Car').trim();
    const dName = (incidentData.driver_name || incidentData.driverName || '').trim() || null;
    const loc = (incidentData.manual_location || incidentData.location || '').trim() || 'Central Sector';
    const incDate = incidentData.date && incidentData.time
      ? `${incidentData.date}T${incidentData.time}`
      : (incidentData.incident_date || incidentData.date || new Date().toISOString());
    const notes = (incidentData.remarks || incidentData.description || '').trim() || null;

    let offencesList = incidentData.offences;
    if (!offencesList || offencesList.length === 0) {
      offencesList = [
        {
          offence_type_id: 'off-spd-01',
          fine_amount: 15000,
          notes: incidentData.offenceType || 'General Traffic Violation',
        },
      ];
    }

    const {
      body_number,
      vehicle_make = 'Standard',
      vehicle_model = 'Standard',
      vehicle_color = 'Standard',
      vehicle_owner_name,
      vehicle_owner_phone,
      driver_license_number,
      location_id,
      location_description,
    } = incidentData;

    const vMake = (incidentData.vehicleMake || vehicle_make || 'Standard').trim();
    const vModel = (incidentData.vehicleModel || vehicle_model || 'Standard').trim();
    const vColor = (incidentData.vehicleColor || vehicle_color || 'Standard').trim();

    const referenceNumber = generateReferenceNumber();
    const incidentId = crypto.randomUUID();
    const dateValue = incDate;

    // Begin interactive write transaction in Turso
    const tx = await turso.transaction('write');

    try {
      // 1. Insert Incident
      const insertIncidentQuery = `
        INSERT INTO incidents (
          id,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded')
      `;

      await tx.execute({
        sql: insertIncidentQuery,
        args: [
          incidentId,
          referenceNumber,
          agentId,
          dateValue,
          location_id || null,
          loc,
          location_description || null,
          plate,
          body_number ? body_number.trim() : null,
          vMake,
          vModel,
          vColor,
          vType,
          vehicle_owner_name ? vehicle_owner_name.trim() : null,
          vehicle_owner_phone ? vehicle_owner_phone.trim() : null,
          driver_license_number ? driver_license_number.trim() : null,
          dName,
          notes,
        ],
      });

      // 2. Insert Offences
      const insertedOffences = [];
      for (const item of offencesList) {
        let fine = item.fine_amount;
        if (fine === undefined || fine === null) {
          try {
            const defaultPenaltyRes = await tx.execute({
              sql: 'SELECT penalty_amount FROM offence_types WHERE id = ?',
              args: [item.offence_type_id],
            });
            fine = defaultPenaltyRes.rows[0]?.penalty_amount ?? 0.0;
          } catch (e) {
            fine = 0.0;
          }
        }

        const offenceId = crypto.randomUUID();
        await tx.execute({
          sql: `INSERT INTO incident_offences (id, incident_id, offence_type_id, fine_amount, notes)
                VALUES (?, ?, ?, ?, ?)`,
          args: [offenceId, incidentId, item.offence_type_id, fine, item.notes || null],
        });

        insertedOffences.push({
          id: offenceId,
          incident_id: incidentId,
          offence_type_id: item.offence_type_id,
          fine_amount: fine,
          notes: item.notes || null,
        });
      }

      // 3. Write Immutable Audit Log
      const auditLogId = crypto.randomUUID();
      await tx.execute({
        sql: `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          auditLogId,
          agentId,
          AUDIT_ACTIONS.INCIDENT_CREATED,
          'incidents',
          incidentId,
          JSON.stringify({
            reference_number: referenceNumber,
            plate_number: plate_number.trim().toUpperCase(),
            offences_count: insertedOffences.length,
          }),
          ipAddress || null,
        ],
      });

      await tx.commit();

      return {
        id: incidentId,
        reference_number: referenceNumber,
        agent_id: agentId,
        incident_date: dateValue,
        plate_number: plate_number.trim().toUpperCase(),
        vehicle_make,
        vehicle_model,
        vehicle_color,
        vehicle_type,
        status: 'recorded',
        offences: insertedOffences,
      };
    } catch (error) {
      await tx.rollback();
      throw error;
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
    const args = [];

    if (reference_number) {
      conditions.push('i.reference_number LIKE ?');
      args.push(`%${reference_number.trim()}%`);
    }

    if (plate_number) {
      conditions.push('i.plate_number LIKE ?');
      args.push(`%${plate_number.trim().toUpperCase()}%`);
    }

    if (body_number) {
      conditions.push('i.body_number LIKE ?');
      args.push(`%${body_number.trim()}%`);
    }

    if (vehicle_type) {
      conditions.push('i.vehicle_type LIKE ?');
      args.push(`%${vehicle_type.trim()}%`);
    }

    if (vehicle_make) {
      conditions.push('i.vehicle_make LIKE ?');
      args.push(`%${vehicle_make.trim()}%`);
    }

    if (vehicle_model) {
      conditions.push('i.vehicle_model LIKE ?');
      args.push(`%${vehicle_model.trim()}%`);
    }

    if (agent_id) {
      conditions.push('i.agent_id = ?');
      args.push(agent_id);
    }

    if (location_id) {
      conditions.push('i.location_id = ?');
      args.push(location_id);
    }

    if (start_date) {
      conditions.push('i.incident_date >= ?');
      args.push(start_date);
    }

    if (end_date) {
      conditions.push('i.incident_date <= ?');
      args.push(end_date);
    }

    // Deduplication when filtering by offence category
    if (category) {
      conditions.push(`EXISTS (
        SELECT 1 
        FROM incident_offences io
        JOIN offence_types ot ON io.offence_type_id = ot.id
        WHERE io.incident_id = i.id AND ot.category LIKE ?
      )`);
      args.push(`%${category.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count
    const countQuery = `
      SELECT COUNT(DISTINCT i.id) AS total
      FROM incidents i
      ${whereClause}
    `;
    const countRes = await turso.execute({ sql: countQuery, args });
    const total = Number(countRes.rows[0].total);

    // Paginated Incidents with Aggregated Offences
    const query = `
      SELECT 
        i.*,
        p.full_name AS agent_name,
        p.badge_number AS agent_badge,
        l.name AS predefined_location_name,
        l.code AS predefined_location_code,
        json_group_array(
          CASE WHEN io.id IS NOT NULL THEN
            json_object(
              'id', io.id,
              'offence_type_id', ot.id,
              'title', ot.title,
              'code', ot.code,
              'category', ot.category,
              'fine_amount', io.fine_amount,
              'notes', io.notes
            )
          ELSE NULL END
        ) AS offences,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_amount
      FROM incidents i
      LEFT JOIN profiles p ON i.agent_id = p.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
      ${whereClause}
      GROUP BY i.id
      ORDER BY i.incident_date DESC
      LIMIT ? OFFSET ?
    `;

    const result = await turso.execute({
      sql: query,
      args: [...args, limit, offset],
    });

    const parsedIncidents = result.rows.map((row) => {
      let offencesList = [];
      try {
        if (typeof row.offences === 'string') {
          const parsed = JSON.parse(row.offences);
          offencesList = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        }
      } catch (e) {
        offencesList = [];
      }

      const dt = row.incident_date ? new Date(row.incident_date) : new Date();
      const timeVal = !isNaN(dt.getTime()) ? dt.toLocaleTimeString('en-GB') : '12:00:00';
      const dateVal = row.incident_date ? String(row.incident_date).slice(0, 10) : '—';

      return {
        ...row,
        time: timeVal,
        date: dateVal,
        offences: offencesList,
        total_fine_amount: Number(row.total_fine_amount),
      };
    });

    return {
      incidents: parsedIncidents,
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
        json_group_array(
          CASE WHEN io.id IS NOT NULL THEN
            json_object(
              'id', io.id,
              'offence_type_id', ot.id,
              'title', ot.title,
              'code', ot.code,
              'category', ot.category,
              'fine_amount', io.fine_amount,
              'demerit_points', ot.demerit_points,
              'notes', io.notes
            )
          ELSE NULL END
        ) AS offences,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_amount
      FROM incidents i
      LEFT JOIN profiles p ON i.agent_id = p.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
      WHERE i.id = ?
      GROUP BY i.id
    `;
    const result = await turso.execute({ sql: query, args: [incidentId] });

    if (result.rows.length === 0) {
      const error = new Error('Incident record not found.');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    let offencesList = [];
    try {
      if (typeof row.offences === 'string') {
        const parsed = JSON.parse(row.offences);
        offencesList = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
    } catch (e) {
      offencesList = [];
    }

    return {
      ...row,
      offences: offencesList,
      total_fine_amount: Number(row.total_fine_amount),
    };
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
        json_group_array(
          CASE WHEN io.id IS NOT NULL THEN
            json_object(
              'id', io.id,
              'offence_type_id', ot.id,
              'title', ot.title,
              'code', ot.code,
              'category', ot.category,
              'fine_amount', io.fine_amount,
              'notes', io.notes
            )
          ELSE NULL END
        ) AS offences,
        COALESCE(SUM(io.fine_amount), 0) AS total_fine_amount
      FROM incidents i
      LEFT JOIN profiles p ON i.agent_id = p.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN incident_offences io ON i.id = io.incident_id
      LEFT JOIN offence_types ot ON io.offence_type_id = ot.id
      WHERE UPPER(i.reference_number) = UPPER(?)
      GROUP BY i.id
    `;
    const result = await turso.execute({ sql: query, args: [referenceNumber] });

    if (result.rows.length === 0) {
      const error = new Error(`Incident with reference ${referenceNumber} not found.`);
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    let offencesList = [];
    try {
      if (typeof row.offences === 'string') {
        const parsed = JSON.parse(row.offences);
        offencesList = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
    } catch (e) {
      offencesList = [];
    }

    return {
      ...row,
      offences: offencesList,
      total_fine_amount: Number(row.total_fine_amount),
    };
  },
};
