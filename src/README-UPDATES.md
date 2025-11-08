ShiftMate – Updates in this PR

Overview

- Added Schedule toggle: My Schedule / Full Schedule at the top right of the Schedule page. Persisted in localStorage. Defaults to My for employees, Full for managers.
- Centralized Requests page with sub-tabs: Time Off and Swaps. Badges/counters show pending items.
- Availability tab:
  - Employees: read-only weekly view with a simple "Request change" form.
  - Managers: full edit of canonical availability (existing Unavailability admin).
- Kept the main schedule grid focused on shifts (removed quick add controls for time-off/unavailability from the grid).

API (Express, JWT-ready stubs)

- Swaps (new endpoints):
  - POST `/api/swaps/offers` { shiftId, type: 'giveaway'|'trade', targetShiftId?, note? }
  - GET `/api/swaps/my`
  - GET `/api/swaps/open`
  - POST `/api/swaps/:id/approve` (manager)
  - POST `/api/swaps/:id/deny` (manager)
  - POST `/api/swaps/:id/claim` (employee; giveaways only)
  - Server enforces: only own shift; prevent double-booking; reject on conflicts (wire to DB).

- Time Off:
  - POST `/api/time-off` { date_from, date_to, note? }
  - GET `/api/my/time-off`
  - GET `/api/time-off` (manager; filter by status/user)
  - POST `/api/time-off/:id/approve` | `/deny`

- Availability:
  - GET `/api/my/availability`, GET `/api/availability?userId=`
  - POST `/api/availability` (manager only) upsert rows

- Schedule (augment):
  - GET `/api/my/shifts?weekStart=YYYY-MM-DD`
  - GET `/api/schedules/:id/shifts?full=1`

DB Migrations

- Added `server/migrations/002_swap_offers_claims.sql` implementing:
  - `swap_offers` (id, shift_id, offered_by, type, target_shift_id, status, note, created_at)
  - Unique index on (shift_id) for active statuses
  - `swap_claims` (id, offer_id, claimed_by, claimed_at)

Notes

- Express routes are wired with demo auth and in-memory storage for this repo; replace with real JWT middleware and Postgres DAO in production.
- UI icons on Full Schedule for open giveaways/trades can be added after hooking real data (kept minimal here to avoid layout noise).
- PDF export and push notifications are intentionally out of scope per request.

Tests

- Vitest: added basic tests for Schedule toggle persistence and the Requests sub-tabs rendering with counters.

