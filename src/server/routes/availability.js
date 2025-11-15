// Availability / unavailability routes backed by Postgres (availability table)
// - Stores canonical weekly availability blocks per user.
// - Employees can only see/edit their own rows.
// - Managers/owners can manage rows for any user at their location.

const { Router } = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = Router();

function mapAvailabilityRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    weekday: row.weekday,
    // The SELECT/RETURNING use to_char(..., 'HH24:MI') so we get HH:MM strings.
    start_hhmm: row.start_hhmm,
    end_hhmm: row.end_hhmm,
    notes: row.notes || '',
  };
}

async function assertUserInLocationOrSelf(req, targetUserId) {
  // Employees may only target themselves.
  if (req.user.role === 'employee') {
    if (targetUserId && targetUserId !== req.user.id) {
      return { error: { status: 403, body: { error: 'forbidden_user' } } };
    }
    return { userId: req.user.id };
  }

  // Managers / owners may manage any user in their location.
  const res = await db.query(
    'SELECT id FROM users WHERE id = $1 AND location_id = $2 AND is_active = true',
    [targetUserId || req.user.id, req.user.location_id]
  );
  const row = res.rows[0];
  if (!row) {
    return { error: { status: 403, body: { error: 'forbidden_user' } } };
  }
  return { userId: row.id };
}

// GET /api/availability?userId=
// - Employees: always scoped to their own user id.
// - Managers/owners: scoped to their location, optional userId filter.
router.get('/availability', requireAuth, async (req, res) => {
  const { userId } = req.query || {};

  const params = [];
  let sql =
    `SELECT a.id,
            a.user_id,
            a.weekday,
            to_char(a.start_time, 'HH24:MI') AS start_hhmm,
            to_char(a.end_time, 'HH24:MI') AS end_hhmm,
            a.note AS notes
       FROM availability a
       JOIN users u ON u.id = a.user_id `;

  if (req.user.role === 'employee') {
    sql += 'WHERE a.user_id = $1';
    params.push(req.user.id);
  } else {
    sql += 'WHERE u.location_id = $1';
    params.push(req.user.location_id);
    if (userId) {
      params.push(userId);
      sql += ` AND a.user_id = $${params.length}`;
    }
  }

  sql += ' ORDER BY a.weekday, a.start_time';

  try {
    const rowsRes = await db.query(sql, params);
    const data = rowsRes.rows.map(mapAvailabilityRow);
    return res.json({ data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /api/availability error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/availability
// Body: { user_id?, weekday, start_hhmm|start_time, end_hhmm|end_time, notes? }
router.post('/availability', requireAuth, async (req, res) => {
  const body = req.body || {};
  const weekday =
    body.weekday != null ? Number(body.weekday) : null;
  const start = body.start_time || body.start_hhmm;
  const end = body.end_time || body.end_hhmm;
  const notes = body.notes || body.note || '';

  if (
    weekday == null ||
    Number.isNaN(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !start ||
    !end
  ) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    const { userId, error } = await assertUserInLocationOrSelf(
      req,
      body.user_id
    );
    if (error) {
      return res.status(error.status).json(error.body);
    }

    const insertRes = await db.query(
      `INSERT INTO availability (user_id, weekday, start_time, end_time, note)
       VALUES ($1, $2, $3::time, $4::time, $5)
       RETURNING id,
                 user_id,
                 weekday,
                 to_char(start_time, 'HH24:MI') AS start_hhmm,
                 to_char(end_time, 'HH24:MI') AS end_hhmm,
                 note AS notes`,
      [userId, weekday, start, end, notes]
    );
    const row = mapAvailabilityRow(insertRes.rows[0]);
    return res.status(201).json({ row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /api/availability error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /api/availability/:id
// Body may include any subset of: { weekday, start_hhmm|start_time, end_hhmm|end_time, notes }
router.patch('/availability/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};

  const weekday =
    body.weekday != null ? Number(body.weekday) : null;
  const start = body.start_time || body.start_hhmm || null;
  const end = body.end_time || body.end_hhmm || null;
  const notes =
    body.notes !== undefined ? body.notes : body.note !== undefined ? body.note : null;

  if (
    weekday != null &&
    (Number.isNaN(weekday) || weekday < 0 || weekday > 6)
  ) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    // Ensure the row is owned by the caller (employee) or in their location (manager/owner).
    let whereClause = 'a.id = $1';
    const params = [id];

    if (req.user.role === 'employee') {
      whereClause += ' AND a.user_id = $2';
      params.push(req.user.id);
    } else {
      whereClause += ' AND u.location_id = $2';
      params.push(req.user.location_id);
    }

    const updateRes = await db.query(
      `UPDATE availability a
       SET weekday = COALESCE($3, a.weekday),
           start_time = COALESCE($4::time, a.start_time),
           end_time = COALESCE($5::time, a.end_time),
           note = COALESCE($6, a.note)
       FROM users u
       WHERE ${whereClause}
         AND u.id = a.user_id
       RETURNING a.id,
                 a.user_id,
                 a.weekday,
                 to_char(a.start_time, 'HH24:MI') AS start_hhmm,
                 to_char(a.end_time, 'HH24:MI') AS end_hhmm,
                 a.note AS notes`,
      [
        ...params,
        weekday != null ? weekday : null,
        start,
        end,
        notes,
      ]
    );

    const row = updateRes.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json({ row: mapAvailabilityRow(row) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('PATCH /api/availability/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /api/availability/:id
router.delete('/availability/:id', requireAuth, async (req, res) => {
  const id = req.params.id;

  try {
    let whereClause = 'a.id = $1';
    const params = [id];

    if (req.user.role === 'employee') {
      whereClause += ' AND a.user_id = $2';
      params.push(req.user.id);
    } else {
      whereClause += ' AND u.location_id = $2';
      params.push(req.user.location_id);
    }

    const delRes = await db.query(
      `DELETE FROM availability a
       USING users u
       WHERE ${whereClause}
         AND u.id = a.user_id
       RETURNING a.id`,
      params
    );

    if (!delRes.rows[0]) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('DELETE /api/availability/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

