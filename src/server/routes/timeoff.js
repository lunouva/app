// Time-off routes (Express) �?" demo in-memory implementation
const { Router } = require('express');
const { requireAuth, requireManager } = require('../auth');

const router = Router();

const timeOff = new Map(); // id -> row

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// POST /api/time-off {date_from, date_to, note?}
router.post('/time-off', requireAuth, (req, res) => {
  const { date_from, date_to, note } = req.body || {};
  if (!date_from || !date_to) return res.status(400).json({ error: 'invalid_payload' });
  const row = { id: uuid(), user_id: req.user.id, date_from, date_to, note: note || '', status: 'pending', created_at: new Date().toISOString() };
  timeOff.set(row.id, row);
  res.json({ request: row });
});

// GET /api/my/time-off
router.get('/my/time-off', requireAuth, (req, res) => {
  const mine = [...timeOff.values()].filter(r => r.user_id === req.user.id);
  res.json({ data: mine });
});

// GET /api/time-off (manager, filter by status/user)
router.get('/time-off', requireAuth, requireManager, (req, res) => {
  const { status, userId } = req.query;
  let rows = [...timeOff.values()];
  if (status) rows = rows.filter(r => r.status === status);
  if (userId) rows = rows.filter(r => r.user_id === userId);
  res.json({ data: rows });
});

// POST /api/time-off/:id/approve | /deny
router.post('/time-off/:id/approve', requireAuth, requireManager, (req, res) => {
  const row = timeOff.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  row.status = 'approved';
  timeOff.set(row.id, row);
  res.json({ request: row });
});
router.post('/time-off/:id/deny', requireAuth, requireManager, (req, res) => {
  const row = timeOff.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  row.status = 'denied';
  timeOff.set(row.id, row);
  res.json({ request: row });
});

module.exports = router;

