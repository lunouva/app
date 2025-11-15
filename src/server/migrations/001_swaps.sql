-- Up: Swap Shifts feature (normalized offer/claim model)
-- This migration is now responsible only for ensuring pgcrypto is available.
-- The canonical swaps tables are defined in 002_swap_offers_claims.sql:
--   swap_offers(id, shift_id, offered_by, type, target_shift_id, status, note, created_at)
--   swap_claims(id, offer_id, claimed_by, claimed_at)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMIT;

-- Down
-- BEGIN;
-- -- No-op: pgcrypto extension is left installed; swap tables are dropped
-- -- by the down migration in 002_swap_offers_claims.sql if needed.
-- COMMIT;
