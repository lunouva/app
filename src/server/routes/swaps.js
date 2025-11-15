// Swap routes (Express) �?" new spec endpoints
// Integrate with your Postgres layer and JWT auth.

const { Router } = require('express');
const { requireAuth, requireManager } = require('../auth');

const router = Router();

// ---- Canonical DB shape (Postgres) ----
// swap_offers: {
//   id, shift_id, offered_by, type, target_shift_id, status, note, created_at
// }
// swap_claims: {
//   id, offer_id, claimed_by, claimed_at
// }

// ---- In-memory store (stub) ----
// Represents rows from swap_offers / swap_claims; replace with real DB calls.
const swapOffers = new Map(); // id -> swap_offers row
const swapClaims = new Map(); // id -> swap_claims row
const userPositions = new Map(); // userId -> Set(positionId)

// demo policy flag
const allowCrossPosition = false; // set true if allowing cross-position trades

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Placeholder checks �?" wire these to DB
// In a real implementation these become queries/joins against shifts, users, positions, user_positions, etc.
async function isShiftOwnedBy(shiftId, userId) {
  // TODO: SELECT 1 FROM shift_assignments WHERE shift_id = $1 AND user_id = $2;
  return true;
}
async function getShiftPosition(shiftId) {
  // TODO: SELECT position_id FROM shifts WHERE id = $1;
  return null;
}
function isQualified(userId, positionId) {
  // TODO: check user_positions(user_id, position_id) in DB
  const set = userPositions.get(userId);
  if (!set) return false;
  return set.has(positionId);
}
async function hasActiveOffer(shiftId) {
  // TODO: SELECT 1 FROM swap_offers WHERE shift_id = $1 AND status IN ('pending','approved','claimed');
  for (const o of swapOffers.values()) {
    if (o.shift_id === shiftId && ['pending', 'approved', 'claimed'].includes(o.status)) return true;
  }
  return false;
}
async function wouldOverlapOrConflict(_userId, _shiftA, _shiftB) {
  // TODO: enforce overlap / business rules using schedule + time off
  return false;
}

// ---- Routes per spec ----

// POST /api/swaps/offers {shiftId, type: 'giveaway'|'trade', targetShiftId?, note?}
router.post('/offers', requireAuth, async (req, res) => {
  const { shiftId, type, targetShiftId, note } = req.body || {};
  if (!shiftId || !['giveaway', 'trade'].includes(type)) {
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
  // In Postgres this would be an INSERT INTO swap_offers(...) RETURNING *;
  // id would typically come from DEFAULT gen_random_uuid() instead of this helper.
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
  swapOffers.set(row.id, row); // swap_offers row (in-memory stub)
  return res.json({ offer: row });
});

// GET /api/swaps/my �+' my offers & inbound requests
router.get('/my', requireAuth, async (req, res) => {
  // TODO: query swap_offers filtered by offered_by and (for inbound) by target_shift_id / location ownership
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

// GET /api/swaps/open �+' manager-approved giveaways available to claim
router.get('/open', requireAuth, async (_req, res) => {
  // TODO: SELECT * FROM swap_offers WHERE type='giveaway' AND status='approved';
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
    // TODO: within a DB transaction, update shift_assignments for both shifts and set status='approved' on swap_offers row
    o.status = 'approved';
  } else {
    // giveaway: keep status=approved; shift becomes open to claim
    // TODO: just UPDATE swap_offers SET status='approved' WHERE id=$1;
    o.status = 'approved';
  }
  swapOffers.set(id, o); // stub for UPDATE swap_offers
  return res.json({ offer: o });
});

// POST /api/swaps/:id/deny (manager)
router.post('/:id/deny', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id;
  const o = swapOffers.get(id);
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (!['pending', 'approved'].includes(o.status)) return res.status(409).json({ error: 'invalid_status' });
  o.status = 'denied';
  // TODO: UPDATE swap_offers SET status='denied' WHERE id=$1;
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
  // TODO: in DB transaction, INSERT INTO swap_claims(...) and update shift_assignments.user_id = claimed_by
  o.status = 'claimed';
  swapOffers.set(id, o); // stub for UPDATE swap_offers SET status='claimed'
  const claim = {
    id: uuid(), // in DB: DEFAULT gen_random_uuid()
    offer_id: id,
    claimed_by: req.user.id,
    claimed_at: new Date().toISOString(),
  };
  swapClaims.set(claim.id, claim); // stub for INSERT INTO swap_claims(...)
  return res.json({ offer: o, claim });
});

module.exports = router;

