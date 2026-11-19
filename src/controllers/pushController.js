// src/controllers/pushController.js
import webpush from 'web-push';
import { db } from '../config/db.js';
import { ENV } from '../config/env.js';
import { sendResponse, sendError } from '../utils/apiResponse.js';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  ENV.VAPID_EMAIL,
  ENV.VAPID_PUBLIC_KEY,
  ENV.VAPID_PRIVATE_KEY
);

// ── Ensure table exists ──────────────────────────────────────────────────

export async function initPushTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ── GET /push/vapid-public-key ───────────────────────────────────────────

export async function getVapidPublicKey(req, res) {
  try {
    return sendResponse(res, 200, 'Public key', { publicKey: ENV.VAPID_PUBLIC_KEY });
  } catch (err) {
    return sendError(res, 500, 'Failed to get public key', err.message);
  }
}

// ── POST /push/subscribe ─────────────────────────────────────────────────

export async function subscribe(req, res) {
  try {
    const userId = req.user.id;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return sendError(res, 400, 'Invalid subscription object');
    }

    await db.execute({
      sql: `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
          user_id = excluded.user_id,
          p256dh  = excluded.p256dh,
          auth    = excluded.auth
      `,
      args: [userId, endpoint, keys.p256dh, keys.auth],
    });

    return sendResponse(res, 201, 'Subscribed successfully');
  } catch (err) {
    return sendError(res, 500, 'Subscription failed', err.message);
  }
}

// ── DELETE /push/unsubscribe ─────────────────────────────────────────────

export async function unsubscribe(req, res) {
  try {
    const userId = req.user.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return sendError(res, 400, 'endpoint required');
    }

    await db.execute({
      sql: `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`,
      args: [userId, endpoint],
    });

    return sendResponse(res, 200, 'Unsubscribed successfully');
  } catch (err) {
    return sendError(res, 500, 'Unsubscribe failed', err.message);
  }
}

// ── POST /push/send ──────────────────────────────────────────────────────

export async function sendPush(req, res) {
  try {
    const { title, body, url = '/dashboard', userIds } = req.body;

    if (!title || !body) {
      return sendError(res, 400, 'title and body are required');
    }

    let result;
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(', ');
      result = await db.execute({
        sql: `SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`,
        args: userIds,
      });
    } else {
      result = await db.execute(`SELECT * FROM push_subscriptions`);
    }

    const subscriptions = result.rows;
    if (subscriptions.length === 0) {
      return sendResponse(res, 200, 'No subscribers found', { sent: 0 });
    }

    const payload = JSON.stringify({ title, body, url });
    let sent = 0;
    let failed = 0;
    const stale = [];

    await Promise.allSettled(
      subscriptions.map(async (row) => {
        const sub = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        try {
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (err) {
          failed++;
          if (err.statusCode === 410) stale.push(row.endpoint);
        }
      })
    );

    for (const endpoint of stale) {
      await db.execute({
        sql: `DELETE FROM push_subscriptions WHERE endpoint = ?`,
        args: [endpoint],
      });
    }

    return sendResponse(res, 200, 'Push sent', { sent, failed, staleCleaned: stale.length });
  } catch (err) {
    return sendError(res, 500, 'Send push failed', err.message);
  }
}
