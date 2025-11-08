-- Swap Offers + Claims model (per new spec)
-- Ensure pgcrypto/gen_random_uuid is available

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS swap_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  offered_by uuid NOT NULL REFERENCES users(id),
  type text CHECK (type IN ('giveaway','trade')) NOT NULL,
  target_shift_id uuid REFERENCES shifts(id), -- required for 'trade'
  status text CHECK (status IN ('pending','approved','denied','canceled','claimed')) NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent more than one active offer on the same shift
CREATE UNIQUE INDEX IF NOT EXISTS uq_swap_offers_active ON swap_offers(shift_id)
  WHERE status IN ('pending','approved','claimed');

CREATE TABLE IF NOT EXISTS swap_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES swap_offers(id) ON DELETE CASCADE,
  claimed_by uuid NOT NULL REFERENCES users(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, claimed_by)
);

COMMIT;

-- Down
-- BEGIN;
-- DROP TABLE IF EXISTS swap_claims;
-- DROP TABLE IF EXISTS swap_offers;
-- COMMIT;

