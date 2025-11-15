// Time-off routes backed by Postgres (time_off_requests table)
// - Employees can only create/view their own requests.
// - Managers/owners can see all requests for their location and approve/deny.

const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = Router();

// Map db row -> API shape expected by the frontend
function mapTimeOffRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    date_from: row.date_from,
    date_to: row.date_to,
    status: row.status,
    notes: row.notes || '',
    created_at: row.created_at,
  };
}

// POST /api/time-off
// Body: { date_from: 'YYYY-MM-DD', date_to: 'YYYY-MM-DD', notes?: string }
// Ignores any user_id in the payload; always uses the authenticated user.
router.post('/time-off', requireAuth, async (req, res) => {
  const body = req.body || {};
  const dateFrom = body.date_from;
  const dateTo = body.date_to;
  const notes = body.notes || body.note || '';

  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    let targetUserId = req.user.id;

    // Allow managers/owners to create requests on behalf of employees
    if (req.user.role !== 'employee' && body.user_id) {
      const checkRes = await db.query(
        'SELECT id FROM users WHERE id = $1 AND location_id = $2 AND is_active = true',
        [body.user_id, req.user.location_id]
      );
      const row = checkRes.rows[0];
      if (!row) {
        return res.status(403).json({ error: 'forbidden_user' });
      }
      targetUserId = row.id;
    }

    const insertRes = await db.query(
      `INSERT INTO time_off_requests (user_id, date_from, date_to, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, date_from, date_to, status, reason AS notes, created_at`,
      [targetUserId, dateFrom, dateTo, notes]
    );
    const row = mapTimeOffRow(insertRes.rows[0]);
    return res.status(201).json({ request: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /api/time-off error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/time-off
// Query params (for managers/owners):
//   - status: filter by request status
//   - userId: filter by specific user within their location
//   - locationId: must match manager's own location if provided
// For employees, this always returns only their own requests; filters are ignored.
router.get('/time-off', requireAuth, async (req, res) => {
  const { status, userId, locationId } = req.query || {};
  const params = [];
  let sql =
    'SELECT r.id, r.user_id, r.date_from, r.date_to, r.status, r.reason AS notes, r.created_at ' +
    'FROM time_off_requests r JOIN users u ON u.id = r.user_id ';

  if (req.user.role === 'employee') {
    sql += 'WHERE r.user_id = $1';
    params.push(req.user.id);
    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
  } else {
    // manager / owner – scoped to their location
    const locId = locationId || req.user.location_id;
    if (!locId || (req.user.location_id && locId !== req.user.location_id)) {
      return res.status(403).json({ error: 'forbidden_location' });
    }
    sql += 'WHERE u.location_id = $1';
    params.push(locId);
    if (userId) {
      params.push(userId);
      sql += ` AND r.user_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
  }

  sql += ' ORDER BY r.created_at DESC';

  try {
    const rowsRes = await db.query(sql, params);
    const data = rowsRes.rows.map(mapTimeOffRow);
    return res.json({ data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /api/time-off error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /api/time-off/:id
// Body: { status: 'approved' | 'denied' }
// Managers/owners only, scoped to their location via the associated user.
router.patch('/time-off/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const status = body.status;

  if (!status || !['pending', 'approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    const updateRes = await db.query(
      `UPDATE time_off_requests r
       SET status = $2
       FROM users u
       WHERE r.id = $1
         AND u.id = r.user_id
         AND u.location_id = $3
       RETURNING r.id, r.user_id, r.date_from, r.date_to, r.status, r.reason AS notes, r.created_at`,
      [id, status, req.user.location_id]
    );

    const row = updateRes.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json({ request: mapTimeOffRow(row) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('PATCH /api/time-off/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
