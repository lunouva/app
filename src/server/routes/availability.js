// Availability routes (Express) — demo in-memory implementation
const { Router } = require('express');
const router = Router();

function parseDemoAuth(h = '') {
  const m = String(h || '').match(/demo\s+(\S+):(\S+)/i);
  if (!m) return null;
  return { id: m[1], role: m[2] };
}

const requireAuth = (req, res, next) => {
  const u = parseDemoAuth(req.get('authorization'));
  if (!u) return res.status(401).json({ error: 'unauthorized' });
  req.user = u; next();
};
const requireManager = (req, res, next) => { if (req.user?.role !== 'employee') return next(); return res.status(403).json({ error: 'forbidden' }); };

// Store: weekly rows per user
// row: { id, user_id, weekday(0-6), start_hhmm, end_hhmm, note }
const availability = new Map();

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

router.get('/my/availability', requireAuth, (req, res) => {
  const rows = [...availability.values()].filter(r => r.user_id === req.user.id);
  res.json({ data: rows });
});

router.get('/availability', requireAuth, (req, res) => {
  const { userId } = req.query;
  let rows = [...availability.values()];
  if (userId) rows = rows.filter(r => r.user_id === userId);
  res.json({ data: rows });
});

// Upsert rows (manager only)
router.post('/availability', requireAuth, requireManager, (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const saved = [];
  for (const r of rows) {
    const id = r.id || uuid();
    const row = { id, user_id: r.user_id, weekday: Number(r.weekday), start_hhmm: String(r.start_hhmm||''), end_hhmm: String(r.end_hhmm||''), note: r.note || '' };
    availability.set(id, row);
    saved.push(row);
  }
  res.json({ rows: saved });
});

module.exports = router;

