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

- See `server/migrations/001_swaps.sql` for full `up` and comments for `down`.
- Tables: `swap_requests`, `swap_offers`, `swap_audit_logs` with indexes.

API (Express stubs)

- Endpoints scaffolded in `server/routes/swaps.js`:
  - POST `/api/swaps/requests` — create request
  - GET `/api/swaps/my` — my requests/offers
  - GET `/api/swaps/requests` — manager queue
  - POST `/api/swaps/offers` — create offer
  - POST `/api/swaps/offers/:id/accept` — requester accepts
  - POST `/api/swaps/requests/:id/cancel` — requester cancels
  - POST `/api/swaps/requests/:id/approve` — manager approves (apply)
  - POST `/api/swaps/requests/:id/decline` — manager declines
  - POST `/api/swaps/offers/:id/reject|withdraw` — manage offer state

Server Apply (transaction)

- give: set `shift_assignments.user_id = offerer_id` for the shift.
- trade: swap assignees between two shifts atomically.
- Validate no overlaps for either, position rules, time-off/availability stubs.
- Append audit; update statuses accordingly.

UI (in this demo app)

- Employees: `Requests` tab → Swap Center:
  - Create request form (give/trade), view/open requests, accept offers, cancel.
  - Offer to cover or trade on others’ open requests.
- Managers: `Requests` tab → Swap requests (queue): approve/decline manager-pending.
- Schedule: unchanged; reassignments reflect in grid after apply.

Rollback

- Drop `swap_audit_logs`, `swap_offers`, `swap_requests` (see comments in migration).

Next Steps

- Wire to real JWT auth and DB.
- Add WebSocket/polling for real-time badges.
- Add Vitest + supertest API tests mirroring the happy paths and rejections.

