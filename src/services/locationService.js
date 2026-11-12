import crypto from 'crypto';
import { turso } from '../config/db.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';
import { auditLogService } from './auditLogService.js';

export const locationService = {
  async getAllLocations(isActiveOnly = true) {
    const query = isActiveOnly
      ? 'SELECT * FROM locations WHERE is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM locations ORDER BY name ASC';
    const result = await turso.execute(query);
    return result.rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
    }));
  },

  async getLocationById(id) {
    const result = await turso.execute({
      sql: 'SELECT * FROM locations WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) {
      const error = new Error('Location not found.');
      error.statusCode = 404;
      throw error;
    }
    const r = result.rows[0];
    return {
      ...r,
      is_active: Boolean(r.is_active),
    };
  },

  async createLocation(locationData, actorId, ipAddress = null) {
    const { name, code, area_or_zone, is_active } = locationData;
    const id = crypto.randomUUID();

    const query = `
      INSERT INTO locations (id, name, code, area_or_zone, is_active)
      VALUES (?, ?, ?, ?, ?)
    `;
    await turso.execute({
      sql: query,
      args: [
        id,
        name.trim(),
        code.trim().toUpperCase(),
        area_or_zone.trim(),
        is_active === false ? 0 : 1,
      ],
    });

    const created = await this.getLocationById(id);

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.LOCATION_CREATED,
      entityType: 'locations',
      entityId: id,
      details: { name: created.name, code: created.code },
      ipAddress,
    });

    return created;
  },

  async updateLocation(id, updateData, actorId, ipAddress = null) {
    const { name, area_or_zone, is_active } = updateData;
    const updates = [];
    const args = [];

    if (name !== undefined) {
      updates.push('name = ?');
      args.push(name.trim());
    }
    if (area_or_zone !== undefined) {
      updates.push('area_or_zone = ?');
      args.push(area_or_zone.trim());
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      args.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.getLocationById(id);
    }

    args.push(id);
    const query = `
      UPDATE locations
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    await turso.execute({ sql: query, args });

    const updated = await this.getLocationById(id);

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.LOCATION_UPDATED,
      entityType: 'locations',
      entityId: id,
      details: updateData,
      ipAddress,
    });

    return updated;
  },
};
