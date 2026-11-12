import { pool } from '../config/db.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

export const offenceService = {
  async getAllOffences({ category, isActiveOnly = true } = {}) {
    const conditions = [];
    const params = [];

    if (isActiveOnly) {
      conditions.push(`is_active = true`);
    }

    if (category) {
      params.push(`%${category}%`);
      conditions.push(`category ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, code, title, description, category, penalty_amount, demerit_points, is_active, created_at, updated_at
      FROM offence_types
      ${whereClause}
      ORDER BY category ASC, title ASC
    `;
    const result = await pool.query(query, params);
    return result.rows;
  },

  async getOffenceById(id) {
    const result = await pool.query(`SELECT * FROM offence_types WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Offence type not found.');
      error.statusCode = 404;
      throw error;
    }
    return result.rows[0];
  },

  async createOffence(offenceData, actorId, ipAddress = null) {
    const { code, title, description, category, penalty_amount, demerit_points, is_active } = offenceData;

    const query = `
      INSERT INTO offence_types (code, title, description, category, penalty_amount, demerit_points, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
      RETURNING *
    `;
    const result = await pool.query(query, [
      code.trim().toUpperCase(),
      title.trim(),
      description || null,
      category.trim(),
      penalty_amount,
      demerit_points || 0,
      is_active,
    ]);

    const created = result.rows[0];

    // Audit Log
    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      actorId,
      AUDIT_ACTIONS.OFFENCE_TYPE_CREATED,
      'offence_types',
      created.id,
      JSON.stringify({ code: created.code, title: created.title, penalty_amount }),
      ipAddress,
    ]);

    return created;
  },

  async updateOffence(id, updateData, actorId, ipAddress = null) {
    const { title, description, category, penalty_amount, demerit_points, is_active } = updateData;
    const updates = [];
    const params = [];

    if (title !== undefined) {
      params.push(title.trim());
      updates.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(category.trim());
      updates.push(`category = $${params.length}`);
    }
    if (penalty_amount !== undefined) {
      params.push(penalty_amount);
      updates.push(`penalty_amount = $${params.length}`);
    }
    if (demerit_points !== undefined) {
      params.push(demerit_points);
      updates.push(`demerit_points = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getOffenceById(id);
    }

    params.push(id);
    const query = `
      UPDATE offence_types
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING *
    `;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      const error = new Error('Offence type not found.');
      error.statusCode = 404;
      throw error;
    }

    const updated = result.rows[0];

    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      actorId,
      AUDIT_ACTIONS.OFFENCE_TYPE_UPDATED,
      'offence_types',
      id,
      JSON.stringify(updateData),
      ipAddress,
    ]);

    return updated;
  },

  async toggleStatus(id, actorId, ipAddress = null) {
    const current = await this.getOffenceById(id);
    const newStatus = !current.is_active;

    const query = `
      UPDATE offence_types
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [newStatus, id]);
    const updated = result.rows[0];

    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      actorId,
      AUDIT_ACTIONS.OFFENCE_TYPE_TOGGLED,
      'offence_types',
      id,
      JSON.stringify({ is_active: newStatus }),
      ipAddress,
    ]);

    return updated;
  },
};
