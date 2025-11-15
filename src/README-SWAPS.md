Swap Shifts (Sling-style) — ShiftMate

Overview

- Employees request to give away or trade a shift.
- Coworkers offer to cover or trade.
- Optional manager approval gate before applying.
- Prevents overlaps, respects positions (configurable), honors cutoff windows.

Settings (demo flags)

- `requireManagerApproval` (default true): gate swaps behind manager.
- `swapCutoffHours` (default 12): cannot create/offers within cutoff of shift start.
- `allowCrossPosition` (default false): allow different positions to trade/cover.

Data Model (SQL)

- Canonical swaps tables live in `server/migrations/002_swap_offers_claims.sql`:
  - `swap_offers` (id, shift_id, offered_by, type, target_shift_id, status, note, created_at)
  - `swap_claims` (id, offer_id, claimed_by, claimed_at, unique (offer_id, claimed_by))
- `server/migrations/001_swaps.sql` is now a thin migration that ensures `pgcrypto` is available; it no longer defines swap tables.

API (Express stubs)

- Offer/claim model endpoints in `server/routes/swaps.js`:
  - POST `/api/swaps/offers` { shiftId, type: 'giveaway'|'trade', targetShiftId?, note? }
  - GET `/api/swaps/my`
  - GET `/api/swaps/open`
  - POST `/api/swaps/:id/approve` (manager)
  - POST `/api/swaps/:id/deny` (manager)
  - POST `/api/swaps/:id/claim` (employee; giveaways only)
  - Handlers are wired to an in-memory store in this repo but are annotated for a real Postgres DAO using `swap_offers` / `swap_claims`.

Server Apply (transaction)

- give: set `shift_assignments.user_id = offerer_id` for the shift.
- trade: swap assignees between two shifts atomically.
- Validate no overlaps for either, position rules, time-off/availability stubs.
- Append audit; update statuses accordingly.

UI (in this demo app)

- Employees: `Requests` tab + Swap Center:
  - Create request form (give/trade), view/open requests, accept offers, cancel.
  - Offer to cover or trade on others’ open requests.
- Managers: `Requests` tab + Swap requests (queue): approve/decline manager-pending.
- Schedule: unchanged; reassignments reflect in grid after apply.

Rollback

- See comments in `002_swap_offers_claims.sql` for dropping `swap_claims` and `swap_offers` if needed.

Next Steps

- Wire to real JWT auth and Postgres instead of the in-memory store.
- Add WebSocket/polling for real-time badges.
- Add Vitest + supertest API tests for swap offers and claims (happy paths + rejection cases).
