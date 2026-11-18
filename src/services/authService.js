import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { turso } from '../config/db.js';
import { ENV } from '../config/env.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';
import { auditLogService } from './auditLogService.js';

export const authService = {
  // Delete a user (admin / supervisor)
  async deleteUser(userId, actorId, ipAddress = null) {
    const profile = await this.getProfile(userId);

    await turso.execute({
      sql: 'DELETE FROM profiles WHERE id = ?',
      args: [userId],
    });

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.USER_DELETED,
      entityType: 'profiles',
      entityId: userId,
      details: { deletedUserId: userId, role: profile.role },
      ipAddress,
    });

    return true;
  },

  async requestPasswordChange(request) {
    const { email, requested_password, reason, officer_name, badge_number } = request;
    // Validate required fields
    if (!email || !requested_password) {
      const err = new Error('Email and requested_password are required.');
      err.statusCode = 400;
      throw err;
    }
    const id = crypto.randomUUID();
    const requested_at = new Date().toISOString();
    const insertSql = `
      INSERT INTO password_requests (
        id, officer_name, badge_number, email, requested_password, reason, status, requested_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `;
    await turso.execute({
      sql: insertSql,
      args: [
        id,
        officer_name || null,
        badge_number || null,
        email,
        requested_password,
        reason || null,
        requested_at,
      ],
    });
    return { id, email, status: 'pending', requested_at };
  },

  async getPasswordRequests() {
    const res = await turso.execute({ sql: 'SELECT * FROM password_requests ORDER BY requested_at DESC' });
    return res.rows;
  },

  async approvePasswordRequest(requestId, admin) {
    // Fetch the request
    const reqRes = await turso.execute({ sql: 'SELECT * FROM password_requests WHERE id = ?', args: [requestId] });
    if (reqRes.rows.length === 0) {
      const err = new Error('Password change request not found.');
      err.statusCode = 404;
      throw err;
    }
    const request = reqRes.rows[0];
    // Update user's password
    const hash = await bcrypt.hash(request.requested_password, 10);
    await turso.execute({
      sql: 'UPDATE profiles SET password_hash = ?, password_change_approved = 1 WHERE email = ?',
      args: [hash, request.email],
    });
    // Mark request as approved
    await turso.execute({
      sql: `UPDATE password_requests SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [admin.id, requestId],
    });
    await auditLogService.createLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE_APPROVED,
      entityType: 'password_requests',
      entityId: requestId,
      details: { email: request.email },
    });
    return { id: requestId, status: 'approved' };
  },

  async rejectPasswordRequest(requestId, admin, reason) {
    const reqRes = await turso.execute({ sql: 'SELECT * FROM password_requests WHERE id = ?', args: [requestId] });
    if (reqRes.rows.length === 0) {
      const err = new Error('Password change request not found.');
      err.statusCode = 404;
      throw err;
    }
    await turso.execute({
      sql: `UPDATE password_requests SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?`,
      args: [admin.id, reason || null, requestId],
    });
    await auditLogService.createLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE_REJECTED,
      entityType: 'password_requests',
      entityId: requestId,
      details: { reason },
    });
    return { id: requestId, status: 'rejected' };
  },
  async login(email, password, ipAddress = null) {
    const query = `
      SELECT id, full_name, badge_number, email, password_hash, role, phone_number, status
      FROM profiles
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `;

    const result = await turso.execute({
      sql: query,
      args: [email],
    });

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

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      badge_number: user.badge_number,
    };

    const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES_IN });

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


  // Export all profiles (admin / supervisor)
  async exportProfiles() {
    const result = await turso.execute({ sql: 'SELECT * FROM profiles', args: [] });
    return result.rows;
  },

  async register(userData, creatorId = null, ipAddress = null) {
    const {
      full_name,
      badge_number,
      email,
      password,
      role,
      phone_number,
    } = userData;

    const checkQuery = `
      SELECT email, badge_number FROM profiles
      WHERE LOWER(email) = LOWER(?) OR UPPER(badge_number) = UPPER(?)
    `;

    const checkResult = await turso.execute({
      sql: checkQuery,
      args: [email, badge_number],
    });

    if (checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];

      const conflictField =
        existing.email.toLowerCase() === email.toLowerCase()
          ? 'Email'
          : 'Badge number';

      const error = new Error(
        `${conflictField} is already registered to an account.`
      );

      error.statusCode = 409;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();

    const insertQuery = `
      INSERT INTO profiles (
        id, full_name, badge_number, email,
        password_hash, role, phone_number, status
      )
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

    await auditLogService.createLog({
      userId: creatorId || id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      entityType: 'profiles',
      entityId: id,
      details: {
        role: newUser.role,
        badge_number: newUser.badge_number,
      },
      ipAddress,
    });

    return newUser;
  },

  async getProfile(userId) {
    const result = await turso.execute({
      sql: `
        SELECT id, full_name, badge_number, email, role,
               phone_number, status, created_at, updated_at
        FROM profiles
        WHERE id = ?
        LIMIT 1
      `,
      args: [userId],
    });

    if (result.rows.length === 0) {
      const error = new Error('User profile not found.');
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  },

  async getProfiles({
    role,
    status,
    search,
    page = 1,
    limit = 20,
  }) {
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
      conditions.push(
        '(full_name LIKE ? OR badge_number LIKE ? OR email LIKE ?)'
      );

      const term = `%${search}%`;
      args.push(term, term, term);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const countQuery = `
      SELECT COUNT(*) AS count
      FROM profiles
      ${whereClause}
    `;

    const totalCountRes = await turso.execute({
      sql: countQuery,
      args,
    });

    const total = Number(totalCountRes.rows[0].count);

    const selectQuery = `
      SELECT id, full_name, badge_number, email, role,
             phone_number, status, created_at, updated_at
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

  async updateProfile(
    userId,
    updateData,
    actorId = null,
    ipAddress = null
  ) {
    const {
      full_name,
      phone_number,
      role,
      status,
    } = updateData;

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

    if (role !== undefined) {
      updates.push('role = ?');
      args.push(role);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      args.push(status);
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

    await turso.execute({
      sql: query,
      args,
    });

    if (role !== undefined) {
      await auditLogService.createLog({
        userId: actorId || userId,
        action: AUDIT_ACTIONS.ROLE_CHANGED,
        entityType: 'profiles',
        entityId: userId,
        details: {
          newRole: role,
          full_name,
          phone_number,
          status,
        },
        ipAddress,
      });
    } else {
      await auditLogService.createLog({
        userId: actorId || userId,
        action: AUDIT_ACTIONS.PROFILE_UPDATED,
        entityType: 'profiles',
        entityId: userId,
        details: updateData,
        ipAddress,
      });
    }

    return this.getProfile(userId);
  },

  async updateRoleAndStatus(
    userId,
    { role, status },
    actorId,
    ipAddress = null
  ) {
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

    await turso.execute({
      sql: query,
      args,
    });

    await auditLogService.createLog({
      userId: actorId,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      entityType: 'profiles',
      entityId: userId,
      details: {
        newRole: role,
        newStatus: status,
      },
      ipAddress,
    });

    return this.getProfile(userId);
  },

  async requestPasswordChange(data) {
    const {
      email,
      officer_name,
      badge_number,
      requested_password,
      reason,
    } = data;

    const newReq = {
      id: 'req-' + Date.now(),
      officer_name:
        officer_name || email?.split('@')[0] || 'Officer',
      badge_number: badge_number || 'N/A',
      email: (email || '').toLowerCase().trim(),
      requested_password: requested_password || 'Password123!',
      reason: reason || 'Credentials update',
      status: 'pending',
      requested_at: new Date().toISOString(),
      approved_by: null,
      approved_at: null,
    };

    try {
      await turso.execute({
        sql: `
          INSERT INTO password_requests (
            id, officer_name, badge_number, email,
            requested_password, reason, status, requested_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          newReq.id,
          newReq.officer_name,
          newReq.badge_number,
          newReq.email,
          newReq.requested_password,
          newReq.reason,
          newReq.status,
          newReq.requested_at,
        ],
      });
    } catch (e) {
      console.warn(
        'Failed to insert password request into DB:',
        e.message
      );
    }

    return newReq;
  },

  async getPasswordRequests() {
    try {
      const res = await turso.execute(`
        SELECT id, officer_name, badge_number, email,
               requested_password, reason, status,
               requested_at, approved_by, approved_at,
               rejection_reason
        FROM password_requests
        ORDER BY datetime(requested_at) DESC
      `);

      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    } catch (e) {
      console.warn(
        'Failed to fetch password requests from DB:',
        e.message
      );
    }

    return [];
  },

  async approvePasswordRequest(requestId, adminUser) {
    if (!adminUser || adminUser.role !== 'admin') {
      const error = new Error(
        'Access Denied: Only an Administrator can approve change of password.'
      );

      error.statusCode = 403;
      throw error;
    }

    const res = await turso.execute({
      sql: 'SELECT * FROM password_requests WHERE id = ? LIMIT 1',
      args: [requestId],
    });

    if (res.rows.length === 0) {
      const error = new Error('Password request not found.');
      error.statusCode = 404;
      throw error;
    }

    const req = res.rows[0];
    const approvedAt = new Date().toISOString();
    const approvedBy =
      adminUser.full_name || 'System Administrator';

    await turso.execute({
      sql: `
        UPDATE password_requests
        SET status = 'approved',
            approved_by = ?,
            approved_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [approvedBy, approvedAt, requestId],
    });

    if (req.requested_password && req.email) {
      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(
          req.requested_password,
          salt
        );

        await turso.execute({
          sql: `
            UPDATE profiles
            SET password_hash = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE LOWER(email) = LOWER(?)
          `,
          args: [hash, req.email],
        });
      } catch (e) {
        console.warn(
          'Could not update profile hash in DB:',
          e.message
        );
      }
    }

    return {
      ...req,
      status: 'approved',
      approved_by: approvedBy,
      approved_at: approvedAt,
    };
  },

  async rejectPasswordRequest(
    requestId,
    adminUser,
    reason = ''
  ) {
    if (!adminUser || adminUser.role !== 'admin') {
      const error = new Error(
        'Access Denied: Only an Administrator can reject password changes.'
      );

      error.statusCode = 403;
      throw error;
    }

    const res = await turso.execute({
      sql: 'SELECT * FROM password_requests WHERE id = ? LIMIT 1',
      args: [requestId],
    });

    if (res.rows.length === 0) {
      const error = new Error('Password request not found.');
      error.statusCode = 404;
      throw error;
    }

    const req = res.rows[0];
    const reviewedAt = new Date().toISOString();
    const reviewedBy =
      adminUser.full_name || 'System Administrator';

    const rejectionReason =
      reason || 'Rejected by Administrator';

    await turso.execute({
      sql: `
        UPDATE password_requests
        SET status = 'rejected',
            approved_by = ?,
            approved_at = ?,
            rejection_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        reviewedBy,
        reviewedAt,
        rejectionReason,
        requestId,
      ],
    });

    return {
      ...req,
      status: 'rejected',
      approved_by: reviewedBy,
      approved_at: reviewedAt,
      rejection_reason: rejectionReason,
    };
  },
};