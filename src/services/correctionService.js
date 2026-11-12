import crypto from 'crypto';
import { turso } from '../config/db.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

export const correctionService = {
  /**
   * Submits a new correction request for an existing incident.
   * Does NOT alter the original incident data.
   */
  async submitRequest({ incidentId, reason, proposedChanges, requesterId, ipAddress = null }) {
    // 1. Verify incident exists
    const incidentCheck = await turso.execute({
      sql: 'SELECT id, reference_number, agent_id FROM incidents WHERE id = ?',
      args: [incidentId],
    });

    if (incidentCheck.rows.length === 0) {
      const error = new Error('Incident not found.');
      error.statusCode = 404;
      throw error;
    }

    const incident = incidentCheck.rows[0];
    const requestId = crypto.randomUUID();

    // 2. Insert correction request
    const insertQuery = `
      INSERT INTO correction_requests (id, incident_id, requested_by, reason, proposed_changes, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;
    await turso.execute({
      sql: insertQuery,
      args: [requestId, incidentId, requesterId, reason.trim(), JSON.stringify(proposedChanges)],
    });

    // 3. Mark incident status as pending_correction
    await turso.execute({
      sql: `UPDATE incidents SET status = 'pending_correction', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [incidentId],
    });

    // 4. Log audit event
    const auditId = crypto.randomUUID();
    await turso.execute({
      sql: `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        auditId,
        requesterId,
        AUDIT_ACTIONS.CORRECTION_REQUESTED,
        'correction_requests',
        requestId,
        JSON.stringify({
          incident_id: incidentId,
          reference_number: incident.reference_number,
          reason: reason.trim(),
        }),
        ipAddress || null,
      ],
    });

    return {
      id: requestId,
      incident_id: incidentId,
      requested_by: requesterId,
      reason: reason.trim(),
      proposed_changes: proposedChanges,
      status: 'pending',
    };
  },

  /**
   * Retrieves correction requests with role-based filtering.
   */
  async getRequests({ status, requesterId, isSupervisorOrAdmin, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const args = [];

    if (!isSupervisorOrAdmin) {
      conditions.push('cr.requested_by = ?');
      args.push(requesterId);
    } else if (requesterId) {
      conditions.push('cr.requested_by = ?');
      args.push(requesterId);
    }

    if (status) {
      conditions.push('cr.status = ?');
      args.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) AS count FROM correction_requests cr ${whereClause}`;
    const countRes = await turso.execute({ sql: countQuery, args });
    const total = Number(countRes.rows[0].count);

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
      LIMIT ? OFFSET ?
    `;

    const result = await turso.execute({
      sql: query,
      args: [...args, limit, offset],
    });

    const parsed = result.rows.map((row) => ({
      ...row,
      proposed_changes: typeof row.proposed_changes === 'string' ? JSON.parse(row.proposed_changes) : row.proposed_changes,
    }));

    return {
      requests: parsed,
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
      WHERE cr.id = ?
    `;
    const result = await turso.execute({ sql: query, args: [requestId] });

    if (result.rows.length === 0) {
      const error = new Error('Correction request not found.');
      error.statusCode = 404;
      throw error;
    }

    const row = result.rows[0];
    return {
      ...row,
      proposed_changes: typeof row.proposed_changes === 'string' ? JSON.parse(row.proposed_changes) : row.proposed_changes,
    };
  },

  /**
   * Approves or rejects a correction request in an interactive Turso transaction.
   */
  async reviewRequest({ requestId, status, rejectionReason, reviewerId, ipAddress = null }) {
    const tx = await turso.transaction('write');

    try {
      // 1. Fetch request
      const requestRes = await tx.execute({
        sql: 'SELECT * FROM correction_requests WHERE id = ?',
        args: [requestId],
      });

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
      const incidentRes = await tx.execute({
        sql: 'SELECT * FROM incidents WHERE id = ?',
        args: [request.incident_id],
      });
      const incident = incidentRes.rows[0];

      if (status === 'rejected') {
        await tx.execute({
          sql: `UPDATE correction_requests 
                SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [rejectionReason, reviewerId, requestId],
        });

        await tx.execute({
          sql: `UPDATE incidents SET status = 'recorded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [request.incident_id],
        });

        // Audit Log
        const auditLogId = crypto.randomUUID();
        await tx.execute({
          sql: `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            auditLogId,
            reviewerId,
            AUDIT_ACTIONS.CORRECTION_REJECTED,
            'correction_requests',
            requestId,
            JSON.stringify({
              incident_id: request.incident_id,
              reference_number: incident.reference_number,
              rejection_reason: rejectionReason,
            }),
            ipAddress || null,
          ],
        });
      } else if (status === 'approved') {
        const changes = typeof request.proposed_changes === 'string'
          ? JSON.parse(request.proposed_changes)
          : request.proposed_changes;

        // Dynamically build update fields for incident
        const updates = ["status = 'amended'", 'updated_at = CURRENT_TIMESTAMP'];
        const updateArgs = [];

        if (changes.plate_number !== undefined) {
          updates.push('plate_number = ?');
          updateArgs.push(changes.plate_number.trim().toUpperCase());
        }
        if (changes.body_number !== undefined) {
          updates.push('body_number = ?');
          updateArgs.push(changes.body_number ? changes.body_number.trim() : null);
        }
        if (changes.vehicle_make !== undefined) {
          updates.push('vehicle_make = ?');
          updateArgs.push(changes.vehicle_make.trim());
        }
        if (changes.vehicle_model !== undefined) {
          updates.push('vehicle_model = ?');
          updateArgs.push(changes.vehicle_model.trim());
        }
        if (changes.vehicle_color !== undefined) {
          updates.push('vehicle_color = ?');
          updateArgs.push(changes.vehicle_color.trim());
        }
        if (changes.vehicle_type !== undefined) {
          updates.push('vehicle_type = ?');
          updateArgs.push(changes.vehicle_type.trim());
        }
        if (changes.vehicle_owner_name !== undefined) {
          updates.push('vehicle_owner_name = ?');
          updateArgs.push(changes.vehicle_owner_name ? changes.vehicle_owner_name.trim() : null);
        }
        if (changes.vehicle_owner_phone !== undefined) {
          updates.push('vehicle_owner_phone = ?');
          updateArgs.push(changes.vehicle_owner_phone ? changes.vehicle_owner_phone.trim() : null);
        }
        if (changes.driver_license_number !== undefined) {
          updates.push('driver_license_number = ?');
          updateArgs.push(changes.driver_license_number ? changes.driver_license_number.trim() : null);
        }
        if (changes.driver_name !== undefined) {
          updates.push('driver_name = ?');
          updateArgs.push(changes.driver_name ? changes.driver_name.trim() : null);
        }
        if (changes.location_id !== undefined) {
          updates.push('location_id = ?');
          updateArgs.push(changes.location_id || null);
        }
        if (changes.manual_location !== undefined) {
          updates.push('manual_location = ?');
          updateArgs.push(changes.manual_location || null);
        }
        if (changes.location_description !== undefined) {
          updates.push('location_description = ?');
          updateArgs.push(changes.location_description || null);
        }
        if (changes.remarks !== undefined) {
          updates.push('remarks = ?');
          updateArgs.push(changes.remarks || null);
        }

        updateArgs.push(request.incident_id);

        await tx.execute({
          sql: `UPDATE incidents SET ${updates.join(', ')} WHERE id = ?`,
          args: updateArgs,
        });

        // Mark request approved
        await tx.execute({
          sql: `UPDATE correction_requests 
                SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [reviewerId, requestId],
        });

        // Write Audit Log
        const auditLogId = crypto.randomUUID();
        await tx.execute({
          sql: `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            auditLogId,
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
            ipAddress || null,
          ],
        });
      }

      await tx.commit();

      return {
        request_id: requestId,
        incident_id: request.incident_id,
        status,
        reviewed_at: new Date().toISOString(),
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
};
