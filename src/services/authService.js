import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { turso } from '../config/db.js';
import { ENV } from '../config/env.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';
import { auditLogService } from './auditLogService.js';

export const authService = {
  async login(email, password, ipAddress = null) {
    const query = `
      SELECT id, full_name, badge_number, email, password_hash, role, phone_number, status
      FROM profiles
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `;
    const result = await turso.execute({ sql: query, args: [email] });

    if (result.rows.length === 0) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      const error = new Error(`Account is ${user.status}. Please contact an administrator.`);
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT Token
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      badge_number: user.badge_number,
    };

    const token = jwt.sign(payload, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });

    // Write login audit log
    await auditLogService.createLog({
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGGED_IN,
      entityType: 'profiles',
      entityId: user.id,
      details: { email: user.email, badge_number: user.badge_number },
      ipAddress,
    });

    const { password_hash, ...profileSafe } = user;
    return { token, user: profileSafe };
  },

  async register(userData, creatorId = null, ipAddress = null) {
    const { full_name, badge_number, email, password, role, phone_number } = userData;

    // Check existing email or badge number
    const checkQuery = `
      SELECT email, badge_number FROM profiles 
      WHERE LOWER(email) = LOWER(?) OR UPPER(badge_number) = UPPER(?)
    `;
    const checkResult = await turso.execute({ sql: checkQuery, args: [email, badge_number] });
    if (checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      const conflictField = existing.email.toLowerCase() === email.toLowerCase() ? 'Email' : 'Badge number';
      const error = new Error(`${conflictField} is already registered to an account.`);
      error.statusCode = 409;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();

    const insertQuery = `
      INSERT INTO profiles (id, full_name, badge_number, email, password_hash, role, phone_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `;
    await turso.execute({
      sql: insertQuery,
      args: [
        id,
        full_name,
        badge_number.toUpperCase(),
        email.toLowerCase(),
        password_hash,
        role,
        phone_number || null,
      ],
    });

    const newUser = await this.getProfile(id);

    // Audit log
    await auditLogService.createLog({
      userId: creatorId || id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      entityType: 'profiles',
      entityId: id,
      details: { role: newUser.role, badge_number: newUser.badge_number },
      ipAddress,
    });

    return newUser;
  },

  async getProfile(userId) {
    const result = await turso.execute({
      sql: `SELECT id, full_name, badge_number, email, role, phone_number, status, created_at, updated_at
            FROM profiles WHERE id = ? LIMIT 1`,
      args: [userId],
    });

    if (result.rows.length === 0) {
      const error = new Error('User profile not found.');
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  },

  async getProfiles({ role, status, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const args = [];

    if (role) {
      conditions.push('role = ?');
      args.push(role);
    }
    if (status) {
      conditions.push('status = ?');
      args.push(status);
    }
    if (search) {
      conditions.push('(full_name LIKE ? OR badge_number LIKE ? OR email LIKE ?)');
      const term = `%${search}%`;
      args.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) AS count FROM profiles ${whereClause}`;
    const totalCountRes = await turso.execute({ sql: countQuery, args });
    const total = Number(totalCountRes.rows[0].count);

    const selectQuery = `
      SELECT id, full_name, badge_number, email, role, phone_number, status, created_at, updated_at
      FROM profiles
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const result = await turso.execute({
      sql: selectQuery,
      args: [...args, limit, offset],
    });

    return {
      profiles: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateProfile(userId, updateData, actorId = null, ipAddress = null) {
    const { full_name, phone_number } = updateData;
    const updates = [];
    const args = [];

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      args.push(full_name);
    }
    if (phone_number !== undefined) {
      updates.push('phone_number = ?');
      args.push(phone_number);
    }

    if (updates.length === 0) {
      return this.getProfile(userId);
    }

    args.push(userId);
    const query = `
      UPDATE profiles
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await turso.execute({ sql: query, args });

    await auditLogService.createLog({
      userId: actorId || userId,
      action: AUDIT_ACTIONS.PROFILE_UPDATED,
      entityType: 'profiles',
      entityId: userId,
      details: updateData,
      ipAddress,
    });

    return this.getProfile(userId);
  },

  async updateRoleAndStatus(userId, { role, status }, actorId, ipAddress = null) {
    const updates = [];
    const args = [];

    if (role) {
      updates.push('role = ?');
      args.push(role);
    }
    if (status) {
      updates.push('status = ?');
      args.push(status);
    }

    args.push(userId);
    const query = `
      UPDATE profiles
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await turso.execute({ sql: query, args });

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      entityType: 'profiles',
      entityId: userId,
      details: { newRole: role, newStatus: status },
      ipAddress,
    });

    return this.getProfile(userId);
  },
};
