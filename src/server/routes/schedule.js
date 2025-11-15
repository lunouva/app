// Schedule and shift routes backed by Postgres.
// Uses schedules, shifts, and shift_assignments tables from 000_core_schema.sql.

const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireManager } = require('../auth');

const router = Router();

function mapShiftRow(row) {
  return {
    id: row.id,
    schedule_id: row.schedule_id,
    position_id: row.position_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    break_min: row.break_min,
    notes: row.notes,
    user_id: row.user_id || null,
  };
}

async function loadScheduleWithShifts(id) {
  const schedRes = await db.query(
    'SELECT id, location_id, week_start, status, published_at, created_by, created_at FROM schedules WHERE id = $1',
    [id]
  );
  const schedule = schedRes.rows[0];
  if (!schedule) return null;

  const shiftsRes = await db.query(
    `SELECT sh.id, sh.schedule_id, sh.position_id, sh.starts_at, sh.ends_at, sh.break_min, sh.notes,
            sa.user_id
     FROM shifts sh
     LEFT JOIN shift_assignments sa ON sa.shift_id = sh.id
     WHERE sh.schedule_id = $1
     ORDER BY sh.starts_at`,
    [id]
  );

  return {
    ...schedule,
    shifts: shiftsRes.rows.map(mapShiftRow),
  };
}

// GET /api/schedules?locationId=&weekStart=
// Returns a single schedule (with shifts) for the given location + week.
router.get('/schedules', requireAuth, async (req, res) => {
  const locationId = req.query.locationId || req.user.location_id;
  const weekStart = req.query.weekStart;

  if (!locationId || !weekStart) {
    return res.status(400).json({ error: 'invalid_params' });
  }

  if (req.user.location_id && req.user.location_id !== locationId) {
    return res.status(403).json({ error: 'forbidden_location' });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM schedules WHERE location_id = $1 AND week_start = $2 LIMIT 1',
      [locationId, weekStart]
    );
    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'not_found' });
    }
    const schedule = await loadScheduleWithShifts(row.id);
    return res.json({ schedule });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /api/schedules error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/schedules
// Body: { locationId?, weekStart, status? }
router.post('/schedules', requireAuth, requireManager, async (req, res) => {
  const body = req.body || {};
  const locationId = body.locationId || req.user.location_id;
  const weekStart = body.weekStart;
  const status = body.status || 'draft';

  if (!locationId || !weekStart) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  if (req.user.location_id && req.user.location_id !== locationId) {
    return res.status(403).json({ error: 'forbidden_location' });
  }

  try {
    // If schedule already exists, return it instead of erroring on UNIQUE constraint.
    const existing = await db.query(
      'SELECT id FROM schedules WHERE location_id = $1 AND week_start = $2 LIMIT 1',
      [locationId, weekStart]
    );
    if (existing.rows[0]) {
      const schedule = await loadScheduleWithShifts(existing.rows[0].id);
      return res.json({ schedule });
    }

    const insertRes = await db.query(
      'INSERT INTO schedules(location_id, week_start, status, created_by) VALUES ($1, $2, $3, $4) RETURNING id, location_id, week_start, status, published_at, created_by, created_at',
      [locationId, weekStart, status, req.user.id]
    );
    const schedule = { ...insertRes.rows[0], shifts: [] };
    return res.status(201).json({ schedule });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /api/schedules error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /api/schedules/:id (e.g., status, published_at)
router.patch('/schedules/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const status = body.status;

  if (!status) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    const existingRes = await db.query(
      'SELECT id, location_id FROM schedules WHERE id = $1',
      [id]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (req.user.location_id && existing.location_id !== req.user.location_id) {
      return res.status(403).json({ error: 'forbidden_location' });
    }

    const updateRes = await db.query(
      `UPDATE schedules
       SET status = $2,
           published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE NULL END
       WHERE id = $1
       RETURNING id, location_id, week_start, status, published_at, created_by, created_at`,
      [id, status]
    );

    const schedule = await loadScheduleWithShifts(updateRes.rows[0].id);
    return res.json({ schedule });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('PATCH /api/schedules/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /api/schedules/:id
router.delete('/schedules/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;

  try {
    const delRes = await db.query(
      `DELETE FROM schedules
       WHERE id = $1 AND location_id = $2
       RETURNING id`,
      [id, req.user.location_id]
    );
    if (!delRes.rows[0]) {
      return res.status(404).json({ error: 'not_found' });
    }
    // shifts and shift_assignments cascade via FK
    return res.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('DELETE /api/schedules/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/schedules/:id/shifts?full=1
router.get('/schedules/:id/shifts', requireAuth, async (req, res) => {
  const id = req.params.id;
  const full = String(req.query.full || '') === '1';

  try {
    const scheduleRes = await db.query(
      'SELECT id, location_id FROM schedules WHERE id = $1',
      [id]
    );
    const schedule = scheduleRes.rows[0];
    if (!schedule) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (req.user.location_id && schedule.location_id !== req.user.location_id) {
      return res.status(403).json({ error: 'forbidden_location' });
    }

    const shiftsRes = await db.query(
      `SELECT sh.id, sh.schedule_id, sh.position_id, sh.starts_at, sh.ends_at, sh.break_min, sh.notes,
              sa.user_id
       FROM shifts sh
       LEFT JOIN shift_assignments sa ON sa.shift_id = sh.id
       WHERE sh.schedule_id = $1
       ORDER BY sh.starts_at`,
      [id]
    );

    let rows = shiftsRes.rows.map(mapShiftRow);
    if (!full) {
      rows = rows.filter(sh => sh.user_id === req.user.id);
    }

    return res.json({ data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /api/schedules/:id/shifts error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/shifts
// Body: { scheduleId, user_id, position_id, starts_at, ends_at, break_min?, notes? }
router.post('/shifts', requireAuth, requireManager, async (req, res) => {
  const body = req.body || {};
  const scheduleId = body.scheduleId;
  const userId = body.user_id;
  const positionId = body.position_id;
  const startsAt = body.starts_at;
  const endsAt = body.ends_at;
  const breakMin = body.break_min != null ? Number(body.break_min) : 0;
  const notes = body.notes || null;

  if (!scheduleId || !userId || !positionId || !startsAt || !endsAt) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  let client;
  try {
    const schedRes = await db.query(
      'SELECT id, location_id FROM schedules WHERE id = $1',
      [scheduleId]
    );
    const schedule = schedRes.rows[0];
    if (!schedule) {
      return res.status(404).json({ error: 'schedule_not_found' });
    }
    if (req.user.location_id && schedule.location_id !== req.user.location_id) {
      return res.status(403).json({ error: 'forbidden_location' });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    const shiftRes = await client.query(
      `INSERT INTO shifts(schedule_id, position_id, starts_at, ends_at, break_min, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, schedule_id, position_id, starts_at, ends_at, break_min, notes`,
      [scheduleId, positionId, startsAt, endsAt, breakMin, notes]
    );
    const shift = shiftRes.rows[0];

    await client.query(
      'INSERT INTO shift_assignments(shift_id, user_id) VALUES ($1, $2)',
      [shift.id, userId]
    );

    await client.query('COMMIT');

    return res.status(201).json({ shift: { ...shift, user_id: userId } });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    // eslint-disable-next-line no-console
    console.error('POST /api/shifts error', err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// PATCH /api/shifts/:id
// Body may include: { user_id, position_id, starts_at, ends_at, break_min, notes }
router.patch('/shifts/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT sh.id, sh.schedule_id, sh.position_id, sh.starts_at, sh.ends_at, sh.break_min, sh.notes,
              sc.location_id
       FROM shifts sh
       JOIN schedules sc ON sc.id = sh.schedule_id
       WHERE sh.id = $1`,
      [id]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }
    if (req.user.location_id && existing.location_id !== req.user.location_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'forbidden_location' });
    }

    const positionId = body.position_id || existing.position_id;
    const startsAt = body.starts_at || existing.starts_at;
    const endsAt = body.ends_at || existing.ends_at;
    const breakMin =
      body.break_min != null ? Number(body.break_min) : existing.break_min;
    const notes =
      body.notes !== undefined ? body.notes : existing.notes;

    const updateRes = await client.query(
      `UPDATE shifts
       SET position_id = $2,
           starts_at = $3,
           ends_at = $4,
           break_min = $5,
           notes = $6
       WHERE id = $1
       RETURNING id, schedule_id, position_id, starts_at, ends_at, break_min, notes`,
      [id, positionId, startsAt, endsAt, breakMin, notes]
    );
    const shift = updateRes.rows[0];

    if (body.user_id !== undefined) {
      await client.query('DELETE FROM shift_assignments WHERE shift_id = $1', [id]);
      if (body.user_id) {
        await client.query(
          'INSERT INTO shift_assignments(shift_id, user_id) VALUES ($1, $2)',
          [id, body.user_id]
        );
      }
    }

    const assignRes = await client.query(
      'SELECT user_id FROM shift_assignments WHERE shift_id = $1 LIMIT 1',
      [id]
    );
    const assignment = assignRes.rows[0];

    await client.query('COMMIT');

    return res.json({
      shift: { ...shift, user_id: assignment ? assignment.user_id : null },
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    // eslint-disable-next-line no-console
    console.error('PATCH /api/shifts/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/shifts/:id
router.delete('/shifts/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;

  try {
    const delRes = await db.query(
      `DELETE FROM shifts sh
       USING schedules sc
       WHERE sh.id = $1
         AND sc.id = sh.schedule_id
         AND sc.location_id = $2
       RETURNING sh.id`,
      [id, req.user.location_id]
    );
    if (!delRes.rows[0]) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('DELETE /api/shifts/:id error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/my/shifts?weekStart=YYYY-MM-DD
router.get('/my/shifts', requireAuth, async (req, res) => {
  const weekStart = req.query.weekStart;

  if (!weekStart) {
    return res.status(400).json({ error: 'invalid_params' });
  }

  try {
    const rowsRes = await db.query(
      `SELECT sh.id, sh.schedule_id, sh.position_id, sh.starts_at, sh.ends_at, sh.break_min, sh.notes,
              sa.user_id
       FROM shifts sh
       JOIN shift_assignments sa ON sa.shift_id = sh.id
       JOIN schedules sc ON sc.id = sh.schedule_id
       WHERE sa.user_id = $1
         AND sc.week_start = $2
       ORDER BY sh.starts_at`,
      [req.user.id, weekStart]
    );

    const data = rowsRes.rows.map(mapShiftRow);
    return res.json({ data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /api/my/shifts error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

