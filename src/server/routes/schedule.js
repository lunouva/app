// Schedule routes (Express) — demo in-memory implementation
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

// In-memory schedule: { id, week_start, shifts:[{id, user_id, position_id, starts_at, ends_at}] }
const schedules = new Map();

router.get('/my/shifts', requireAuth, (req, res) => {
  // Filter by weekStart if provided
  const { weekStart } = req.query;
  let out = [];
  for (const s of schedules.values()) {
    if (weekStart && s.week_start !== weekStart) continue;
    out = out.concat((s.shifts || []).filter(sh => sh.user_id === req.user.id));
  }
  res.json({ data: out });
});

router.get('/schedules/:id/shifts', requireAuth, (req, res) => {
  const sch = schedules.get(req.params.id);
  if (!sch) return res.status(404).json({ error: 'not_found' });
  const full = String(req.query.full || '') === '1';
  if (full) return res.json({ data: sch.shifts || [] });
  // If not full, only return current user's shifts
  const mine = (sch.shifts || []).filter(sh => sh.user_id === req.user.id);
  res.json({ data: mine });
});

module.exports = router;

