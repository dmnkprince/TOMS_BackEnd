import crypto from 'crypto';
import { turso } from '../config/db.js';

export const auditLogService = {
  /**
   * Appends an immutable audit log record.
   */
  async createLog({ userId, action, entityType, entityId, details = {}, ipAddress = null }) {
    try {
      const id = crypto.randomUUID();
      const query = `
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await turso.execute({
        sql: query,
        args: [
          id,
          userId || null,
          action,
          entityType,
          entityId || null,
          JSON.stringify(details),
          ipAddress || null,
        ],
      });
      return { id, action, created_at: new Date().toISOString() };
    } catch (error) {
      console.error('⚠️ Failed to write audit log:', error.message);
      return null;
    }
  },

  /**
   * Retrieves paginated audit logs with search filters.
   */
  async getLogs({ page = 1, limit = 50, action, entityType, userId, startDate, endDate }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const args = [];

    if (action) {
      conditions.push('a.action = ?');
      args.push(action);
    }
    if (entityType) {
      conditions.push('a.entity_type = ?');
      args.push(entityType);
    }
    if (userId) {
      conditions.push('a.user_id = ?');
      args.push(userId);
    }
    if (startDate) {
      conditions.push('a.created_at >= ?');
      args.push(startDate);
    }
    if (endDate) {
      conditions.push('a.created_at <= ?');
      args.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) AS count FROM audit_logs a ${whereClause}`;
    const countRes = await turso.execute({ sql: countQuery, args });
    const total = Number(countRes.rows[0].count);

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
      LIMIT ? OFFSET ?
    `;
    const result = await turso.execute({
      sql: selectQuery,
      args: [...args, limit, offset],
    });

    const parsedLogs = result.rows.map((row) => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }));

    return {
      logs: parsedLogs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
