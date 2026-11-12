import { pool } from '../config/db.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

export const correctionService = {
  /**
   * Submits a new correction request for an existing incident.
   * Does NOT alter the original incident data.
   */
  async submitRequest({ incidentId, reason, proposedChanges, requesterId, ipAddress = null }) {
    // 1. Verify incident exists
    const incidentCheck = await pool.query(`SELECT id, reference_number, agent_id FROM incidents WHERE id = $1`, [incidentId]);
    if (incidentCheck.rows.length === 0) {
      const error = new Error('Incident not found.');
      error.statusCode = 404;
      throw error;
    }

    const incident = incidentCheck.rows[0];

    // 2. Insert correction request
    const insertQuery = `
      INSERT INTO correction_requests (incident_id, requested_by, reason, proposed_changes, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      incidentId,
      requesterId,
      reason.trim(),
      JSON.stringify(proposedChanges),
    ]);

    const createdRequest = result.rows[0];

    // 3. Mark incident status as pending_correction
    await pool.query(
      `UPDATE incidents SET status = 'pending_correction', updated_at = NOW() WHERE id = $1`,
      [incidentId]
    );

    // 4. Log audit event
    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      requesterId,
      AUDIT_ACTIONS.CORRECTION_REQUESTED,
      'correction_requests',
      createdRequest.id,
      JSON.stringify({
        incident_id: incidentId,
        reference_number: incident.reference_number,
        reason: reason.trim(),
      }),
      ipAddress,
    ]);

    return createdRequest;
  },

  /**
   * Retrieves correction requests with role-based filtering.
   */
  async getRequests({ status, requesterId, isSupervisorOrAdmin, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    // If agent, restrict strictly to their own requests
    if (!isSupervisorOrAdmin) {
      params.push(requesterId);
      conditions.push(`cr.requested_by = $${params.length}`);
    } else if (requesterId) {
      // Supervisor can optionally filter by a specific agent
      params.push(requesterId);
      conditions.push(`cr.requested_by = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`cr.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM correction_requests cr ${whereClause}`;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const query = `
      SELECT 
        cr.*,
        i.reference_number AS incident_reference,
        i.plate_number,
        req_p.full_name AS requester_name,
        req_p.badge_number AS requester_badge,
        rev_p.full_name AS reviewer_name,
        rev_p.badge_number AS reviewer_badge
      FROM correction_requests cr
      JOIN incidents i ON cr.incident_id = i.id
      JOIN profiles req_p ON cr.requested_by = req_p.id
      LEFT JOIN profiles rev_p ON cr.reviewed_by = rev_p.id
      ${whereClause}
      ORDER BY cr.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await pool.query(query, params);

    return {
      requests: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Retrieves specific correction request with side-by-side original incident data.
   */
  async getRequestById(requestId) {
    const query = `
      SELECT 
        cr.*,
        i.reference_number AS incident_reference,
        i.plate_number AS original_plate_number,
        i.body_number AS original_body_number,
        i.vehicle_make AS original_vehicle_make,
        i.vehicle_model AS original_vehicle_model,
        i.vehicle_color AS original_vehicle_color,
        i.vehicle_type AS original_vehicle_type,
        i.vehicle_owner_name AS original_vehicle_owner_name,
        i.vehicle_owner_phone AS original_vehicle_owner_phone,
        i.driver_license_number AS original_driver_license_number,
        i.driver_name AS original_driver_name,
        i.remarks AS original_remarks,
        req_p.full_name AS requester_name,
        req_p.badge_number AS requester_badge,
        rev_p.full_name AS reviewer_name,
        rev_p.badge_number AS reviewer_badge
      FROM correction_requests cr
      JOIN incidents i ON cr.incident_id = i.id
      JOIN profiles req_p ON cr.requested_by = req_p.id
      LEFT JOIN profiles rev_p ON cr.reviewed_by = rev_p.id
      WHERE cr.id = $1
    `;
    const result = await pool.query(query, [requestId]);

    if (result.rows.length === 0) {
      const error = new Error('Correction request not found.');
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  },

  /**
   * Approves or rejects a correction request in an ACID database transaction.
   */
  async reviewRequest({ requestId, status, rejectionReason, reviewerId, ipAddress = null }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Fetch and lock request
      const requestRes = await client.query(
        `SELECT * FROM correction_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      if (requestRes.rows.length === 0) {
        const error = new Error('Correction request not found.');
        error.statusCode = 404;
        throw error;
      }

      const request = requestRes.rows[0];

      if (request.status !== 'pending') {
        const error = new Error(`Request has already been ${request.status}.`);
        error.statusCode = 400;
        throw error;
      }

      // 2. Fetch associated incident
      const incidentRes = await client.query(
        `SELECT * FROM incidents WHERE id = $1 FOR UPDATE`,
        [request.incident_id]
      );
      const incident = incidentRes.rows[0];

      if (status === 'rejected') {
        // Update request as rejected
        await client.query(
          `UPDATE correction_requests 
           SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
           WHERE id = $3`,
          [rejectionReason, reviewerId, requestId]
        );

        // Revert incident status back to recorded (or original)
        await client.query(
          `UPDATE incidents SET status = 'recorded', updated_at = NOW() WHERE id = $1`,
          [request.incident_id]
        );

        // Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            reviewerId,
            AUDIT_ACTIONS.CORRECTION_REJECTED,
            'correction_requests',
            requestId,
            JSON.stringify({
              incident_id: request.incident_id,
              reference_number: incident.reference_number,
              rejection_reason: rejectionReason,
            }),
            ipAddress,
          ]
        );
      } else if (status === 'approved') {
        const changes = request.proposed_changes;

        // Apply changes to incident snapshot
        const updateIncidentQuery = `
          UPDATE incidents SET
            plate_number = COALESCE(UPPER(TRIM($1)), plate_number),
            body_number = COALESCE(NULLIF(TRIM($2), ''), body_number),
            vehicle_make = COALESCE(TRIM($3), vehicle_make),
            vehicle_model = COALESCE(TRIM($4), vehicle_model),
            vehicle_color = COALESCE(TRIM($5), vehicle_color),
            vehicle_type = COALESCE(TRIM($6), vehicle_type),
            vehicle_owner_name = COALESCE(NULLIF(TRIM($7), ''), vehicle_owner_name),
            vehicle_owner_phone = COALESCE(NULLIF(TRIM($8), ''), vehicle_owner_phone),
            driver_license_number = COALESCE(NULLIF(TRIM($9), ''), driver_license_number),
            driver_name = COALESCE(NULLIF(TRIM($10), ''), driver_name),
            location_id = CASE WHEN $11::boolean THEN NULLIF($12, '')::uuid ELSE location_id END,
            manual_location = CASE WHEN $13::boolean THEN NULLIF($14, '') ELSE manual_location END,
            location_description = CASE WHEN $15::boolean THEN NULLIF($16, '') ELSE location_description END,
            remarks = CASE WHEN $17::boolean THEN NULLIF($18, '') ELSE remarks END,
            status = 'amended',
            updated_at = NOW()
          WHERE id = $19
        `;

        await client.query(updateIncidentQuery, [
          changes.plate_number || null,
          changes.body_number || null,
          changes.vehicle_make || null,
          changes.vehicle_model || null,
          changes.vehicle_color || null,
          changes.vehicle_type || null,
          changes.vehicle_owner_name || null,
          changes.vehicle_owner_phone || null,
          changes.driver_license_number || null,
          changes.driver_name || null,
          'location_id' in changes,
          changes.location_id || null,
          'manual_location' in changes,
          changes.manual_location || null,
          'location_description' in changes,
          changes.location_description || null,
          'remarks' in changes,
          changes.remarks || null,
          request.incident_id,
        ]);

        // Update request as approved
        await client.query(
          `UPDATE correction_requests 
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
           WHERE id = $2`,
          [reviewerId, requestId]
        );

        // Audit Log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            reviewerId,
            AUDIT_ACTIONS.CORRECTION_APPROVED,
            'correction_requests',
            requestId,
            JSON.stringify({
              incident_id: request.incident_id,
              reference_number: incident.reference_number,
              requested_by: request.requested_by,
              applied_changes: changes,
            }),
            ipAddress,
          ]
        );
      }

      await client.query('COMMIT');

      return {
        request_id: requestId,
        incident_id: request.incident_id,
        status,
        reviewed_at: new Date().toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
