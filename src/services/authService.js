import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { ENV } from '../config/env.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';
import { auditLogService } from './auditLogService.js';

export const authService = {
  async login(email, password, ipAddress = null) {
    const query = `
      SELECT id, full_name, badge_number, email, password_hash, role, phone_number, status
      FROM profiles
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `;
    const result = await pool.query(query, [email]);

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
      WHERE LOWER(email) = LOWER($1) OR UPPER(badge_number) = UPPER($2)
    `;
    const checkResult = await pool.query(checkQuery, [email, badge_number]);
    if (checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      const conflictField = existing.email.toLowerCase() === email.toLowerCase() ? 'Email' : 'Badge number';
      const error = new Error(`${conflictField} is already registered to an account.`);
      error.statusCode = 409;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const insertQuery = `
      INSERT INTO profiles (full_name, badge_number, email, password_hash, role, phone_number, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING id, full_name, badge_number, email, role, phone_number, status, created_at
    `;
    const result = await pool.query(insertQuery, [
      full_name,
      badge_number.toUpperCase(),
      email.toLowerCase(),
      password_hash,
      role,
      phone_number || null,
    ]);

    const newUser = result.rows[0];

    // Audit log
    await auditLogService.createLog({
      userId: creatorId || newUser.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      entityType: 'profiles',
      entityId: newUser.id,
      details: { role: newUser.role, badge_number: newUser.badge_number },
      ipAddress,
    });

    return newUser;
  },

  async getProfile(userId) {
    const result = await pool.query(
      `SELECT id, full_name, badge_number, email, role, phone_number, status, created_at, updated_at
       FROM profiles WHERE id = $1`,
      [userId]
    );

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
    const params = [];

    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(full_name ILIKE $${params.length} OR badge_number ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM profiles ${whereClause}`;
    const totalCountRes = await pool.query(countQuery, params);
    const total = parseInt(totalCountRes.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const selectQuery = `
      SELECT id, full_name, badge_number, email, role, phone_number, status, created_at, updated_at
      FROM profiles
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await pool.query(selectQuery, params);

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
    const params = [];

    if (full_name !== undefined) {
      params.push(full_name);
      updates.push(`full_name = $${params.length}`);
    }
    if (phone_number !== undefined) {
      params.push(phone_number);
      updates.push(`phone_number = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getProfile(userId);
    }

    params.push(userId);
    const query = `
      UPDATE profiles
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING id, full_name, badge_number, email, role, phone_number, status, updated_at
    `;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      const error = new Error('Profile not found.');
      error.statusCode = 404;
      throw error;
    }

    await auditLogService.createLog({
      userId: actorId || userId,
      action: AUDIT_ACTIONS.PROFILE_UPDATED,
      entityType: 'profiles',
      entityId: userId,
      details: updateData,
      ipAddress,
    });

    return result.rows[0];
  },

  async updateRoleAndStatus(userId, { role, status }, actorId, ipAddress = null) {
    const updates = [];
    const params = [];

    if (role) {
      params.push(role);
      updates.push(`role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }

    params.push(userId);
    const query = `
      UPDATE profiles
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING id, full_name, badge_number, email, role, phone_number, status, updated_at
    `;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      const error = new Error('Profile not found.');
      error.statusCode = 404;
      throw error;
    }

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      entityType: 'profiles',
      entityId: userId,
      details: { newRole: role, newStatus: status },
      ipAddress,
    });

    return result.rows[0];
  },
};
