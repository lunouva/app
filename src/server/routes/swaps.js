// Swap routes (Express) — new spec endpoints
// Integrate with your Postgres layer and JWT auth.

const { Router } = require('express');
const router = Router();

// ---- Demo auth guards (replace with real JWT) ----
// Accept header: Authorization: "demo <userId>:<role>"
function parseDemoAuth(h = '') {
  const m = String(h || '').match(/demo\s+(\S+):(\S+)/i);
  if (!m) return null;
  return { id: m[1], role: m[2] };
}

const requireAuth = (req, res, next) => {
  const u = parseDemoAuth(req.get('authorization'));
  if (!u) return res.status(401).json({ error: 'unauthorized' });
  req.user = u;
  next();
};

const requireManager = (req, res, next) => {
  if (req.user?.role && req.user.role !== 'employee') return next();
  return res.status(403).json({ error: 'forbidden' });
};

// ---- In-memory store (stub) ----
// Replace with real DB calls. Shapes align with migration.
const swapOffers = new Map(); // id -> offer
const swapClaims = new Map(); // id -> claim
const userPositions = new Map(); // userId -> Set(positionId)

// demo policy flag
const allowCrossPosition = false; // set true if allowing cross-position trades

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Placeholder checks — wire these to DB
async function isShiftOwnedBy(shiftId, userId) { return true; }
async function getShiftPosition(shiftId) { return null; } // TODO: fetch from DB
function isQualified(userId, positionId) {
  const set = userPositions.get(userId);
  if (!set) return false;
  return set.has(positionId);
}
async function hasActiveOffer(shiftId) {
  for (const o of swapOffers.values()) {
    if (o.shift_id === shiftId && ['pending','approved','claimed'].includes(o.status)) return true;
  }
  return false;
}
async function wouldOverlapOrConflict(_userId, _shiftA, _shiftB) { return false; }

// ---- Routes per spec ----

// POST /api/swaps/offers {shiftId, type: 'giveaway'|'trade', targetShiftId?, note?}
router.post('/offers', requireAuth, async (req, res) => {
  const { shiftId, type, targetShiftId, note } = req.body || {};
  if (!shiftId || !['giveaway','trade'].includes(type)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  if (type === 'trade' && !targetShiftId) {
    return res.status(400).json({ error: 'target_shift_required' });
  }
  if (type === 'giveaway' && targetShiftId) {
    return res.status(400).json({ error: 'target_shift_not_allowed' });
  }
  if (!(await isShiftOwnedBy(shiftId, req.user.id))) {
    return res.status(403).json({ error: 'not_shift_owner' });
  }
  if (await hasActiveOffer(shiftId)) {
    return res.status(409).json({ error: 'active_offer_exists' });
  }
  if (type === 'trade') {
    // Position/cross-train checks (placeholder until wired to DB)
    const posA = await getShiftPosition(shiftId);
    const posB = await getShiftPosition(targetShiftId);
    if (posA && posB && posA !== posB && !allowCrossPosition) {
      return res.status(409).json({ error: 'position_mismatch' });
    }
    // Reject when overlaps/conflicts exist
    if (await wouldOverlapOrConflict(req.user.id, shiftId, targetShiftId)) {
      return res.status(409).json({ error: 'conflict' });
    }
  }
  const now = new Date().toISOString();
  const row = {
    id: uuid(),
    shift_id: shiftId,
    offered_by: req.user.id,
    type,
    target_shift_id: targetShiftId || null,
    status: 'pending',
    note: note || '',
    created_at: now,
  };
  swapOffers.set(row.id, row);
  return res.json({ offer: row });
});

// GET /api/swaps/my → my offers & inbound requests
router.get('/my', requireAuth, async (req, res) => {
  const my = [];
  const inbound = [];
  for (const o of swapOffers.values()) {
    if (o.offered_by === req.user.id) my.push(o);
    // inbound requests: giveaways approved/open to claim, or trades targeting my shift
    if (o.type === 'giveaway' && o.status === 'approved') inbound.push(o);
    if (o.type === 'trade' /* and target shift belongs to me (requires DB) */) {
      // With DB: include when target_shift_id is mine
    }
  }
  return res.json({ my, inbound });
});

// GET /api/swaps/open → manager-approved giveaways available to claim
router.get('/open', requireAuth, async (_req, res) => {
  const open = [...swapOffers.values()].filter(o => o.type === 'giveaway' && o.status === 'approved');
  return res.json({ data: open });
});

// POST /api/swaps/:id/approve (manager)
router.post('/:id/approve', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;
  const o = swapOffers.get(id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.status !== 'pending') return res.status(409).json({ error: 'invalid_status' });
  if (o.type === 'trade') {
    // Immediately swap assignments (server-side transaction in real app)
    // TODO: implement with DB
    o.status = 'approved';
  } else {
    // giveaway: keep status=approved; shift becomes open to claim
    o.status = 'approved';
  }
  swapOffers.set(id, o);
  return res.json({ offer: o });
});

// POST /api/swaps/:id/deny (manager)
router.post('/:id/deny', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;
  const o = swapOffers.get(id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (!['pending','approved'].includes(o.status)) return res.status(409).json({ error: 'invalid_status' });
  o.status = 'denied';
  swapOffers.set(id, o);
  return res.json({ offer: o });
});

// POST /api/swaps/:id/claim (employee; giveaways only)
router.post('/:id/claim', requireAuth, async (req, res) => {
  const id = req.params.id;
  const o = swapOffers.get(id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.type !== 'giveaway') return res.status(400).json({ error: 'not_giveaway' });
  if (o.status !== 'approved') return res.status(409).json({ error: 'not_open' });
  // Prevent double-booking/overlap (requires DB); placeholder rejects none
  // Apply reassignment: shift_assignments.user_id = claimed_by (in DB)
  o.status = 'claimed';
  swapOffers.set(id, o);
  const claim = { id: uuid(), offer_id: id, claimed_by: req.user.id, claimed_at: new Date().toISOString() };
  swapClaims.set(claim.id, claim);
  return res.json({ offer: o, claim });
});

module.exports = router;
