import crypto from 'crypto';
import { turso } from '../config/db.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';
import { auditLogService } from './auditLogService.js';

export const offenceService = {
  async getAllOffences({ category, isActiveOnly = true } = {}) {
    const conditions = [];
    const args = [];

    if (isActiveOnly) {
      conditions.push('is_active = 1');
    }

    if (category) {
      conditions.push('category LIKE ?');
      args.push(`%${category}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, code, title, description, category, penalty_amount, demerit_points, is_active, created_at, updated_at
      FROM offence_types
      ${whereClause}
      ORDER BY category ASC, title ASC
    `;
    const result = await turso.execute({ sql: query, args });
    return result.rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
      penalty_amount: Number(r.penalty_amount),
      demerit_points: Number(r.demerit_points),
    }));
  },

  async getOffenceById(id) {
    const result = await turso.execute({
      sql: 'SELECT * FROM offence_types WHERE id = ?',
      args: [id],
    });
    if (result.rows.length === 0) {
      const error = new Error('Offence type not found.');
      error.statusCode = 404;
      throw error;
    }
    const r = result.rows[0];
    return {
      ...r,
      is_active: Boolean(r.is_active),
      penalty_amount: Number(r.penalty_amount),
      demerit_points: Number(r.demerit_points),
    };
  },

  async createOffence(offenceData, actorId, ipAddress = null) {
    const { code, title, description, category, penalty_amount, demerit_points, is_active } = offenceData;
    const id = crypto.randomUUID();

    const query = `
      INSERT INTO offence_types (id, code, title, description, category, penalty_amount, demerit_points, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await turso.execute({
      sql: query,
      args: [
        id,
        code.trim().toUpperCase(),
        title.trim(),
        description || null,
        category.trim(),
        penalty_amount,
        demerit_points || 0,
        is_active === false ? 0 : 1,
      ],
    });

    const created = await this.getOffenceById(id);

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.OFFENCE_TYPE_CREATED,
      entityType: 'offence_types',
      entityId: id,
      details: { code: created.code, title: created.title, penalty_amount },
      ipAddress,
    });

    return created;
  },

  async updateOffence(id, updateData, actorId, ipAddress = null) {
    const { title, description, category, penalty_amount, demerit_points, is_active } = updateData;
    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const args = [];

    if (title !== undefined) {
      updates.push('title = ?');
      args.push(title.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      args.push(description);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      args.push(category.trim());
    }
    if (penalty_amount !== undefined) {
      updates.push('penalty_amount = ?');
      args.push(penalty_amount);
    }
    if (demerit_points !== undefined) {
      updates.push('demerit_points = ?');
      args.push(demerit_points);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      args.push(is_active ? 1 : 0);
    }

    args.push(id);
    const query = `
      UPDATE offence_types
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    await turso.execute({ sql: query, args });

    const updated = await this.getOffenceById(id);

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.OFFENCE_TYPE_UPDATED,
      entityType: 'offence_types',
      entityId: id,
      details: updateData,
      ipAddress,
    });

    return updated;
  },

  async toggleStatus(id, actorId, ipAddress = null) {
    const current = await this.getOffenceById(id);
    const newStatus = current.is_active ? 0 : 1;

    const query = `
      UPDATE offence_types
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await turso.execute({ sql: query, args: [newStatus, id] });

    const updated = await this.getOffenceById(id);

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.OFFENCE_TYPE_TOGGLED,
      entityType: 'offence_types',
      entityId: id,
      details: { is_active: Boolean(newStatus) },
      ipAddress,
    });

    return updated;
  },
};
