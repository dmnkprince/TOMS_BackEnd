import { pool } from '../config/db.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

export const locationService = {
  async getAllLocations(isActiveOnly = true) {
    const query = isActiveOnly
      ? `SELECT * FROM locations WHERE is_active = true ORDER BY name ASC`
      : `SELECT * FROM locations ORDER BY name ASC`;
    const result = await pool.query(query);
    return result.rows;
  },

  async getLocationById(id) {
    const result = await pool.query(`SELECT * FROM locations WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      const error = new Error('Location not found.');
      error.statusCode = 404;
      throw error;
    }
    return result.rows[0];
  },

  async createLocation(locationData, actorId, ipAddress = null) {
    const { name, code, area_or_zone, is_active } = locationData;

    const query = `
      INSERT INTO locations (name, code, area_or_zone, is_active)
      VALUES ($1, $2, $3, COALESCE($4, true))
      RETURNING *
    `;
    const result = await pool.query(query, [
      name.trim(),
      code.trim().toUpperCase(),
      area_or_zone.trim(),
      is_active,
    ]);

    const created = result.rows[0];

    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(auditQuery, [
      actorId,
      AUDIT_ACTIONS.LOCATION_CREATED,
      'locations',
      created.id,
      JSON.stringify({ name: created.name, code: created.code }),
      ipAddress,
    ]);

    return created;
  },

  async updateLocation(id, updateData, actorId, ipAddress = null) {
    const { name, area_or_zone, is_active } = updateData;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      params.push(name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (area_or_zone !== undefined) {
      params.push(area_or_zone.trim());
      updates.push(`area_or_zone = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getLocationById(id);
    }

    params.push(id);
    const query = `
      UPDATE locations
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      const error = new Error('Location not found.');
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
      AUDIT_ACTIONS.LOCATION_UPDATED,
      'locations',
      id,
      JSON.stringify(updateData),
      ipAddress,
    ]);

    return updated;
  },
};
