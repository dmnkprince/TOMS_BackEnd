import { pool } from '../config/db.js';

export const auditLogService = {
  /**
   * Appends an immutable audit log record.
   */
  async createLog({ userId, action, entityType, entityId, details = {}, ipAddress = null }) {
    try {
      const query = `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `;
      const result = await pool.query(query, [
        userId || null,
        action,
        entityType,
        entityId || null,
        JSON.stringify(details),
        ipAddress,
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('⚠️ Failed to write audit log:', error.message);
      // Non-blocking so core operations don't fail if audit log table has temporary issues
      return null;
    }
  },

  /**
   * Retrieves paginated audit logs with search filters.
   */
  async getLogs({ page = 1, limit = 50, action, entityType, userId, startDate, endDate }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (action) {
      params.push(action);
      conditions.push(`a.action = $${params.length}`);
    }
    if (entityType) {
      params.push(entityType);
      conditions.push(`a.entity_type = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      conditions.push(`a.user_id = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`a.created_at >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`a.created_at <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM audit_logs a ${whereClause}`;
    const totalCountRes = await pool.query(countQuery, params);
    const total = parseInt(totalCountRes.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const selectQuery = `
      SELECT 
        a.id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.ip_address,
        a.created_at,
        p.full_name AS user_name,
        p.badge_number,
        p.role AS user_role
      FROM audit_logs a
      LEFT JOIN profiles p ON a.user_id = p.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await pool.query(selectQuery, params);

    return {
      logs: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
