-- Up: Swap Shifts feature tables
-- Note: uses pgcrypto/gen_random_uuid(); ensure extension enabled in your DB

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('give','trade')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','offered','manager_pending','approved','declined','canceled','expired')),
  message TEXT,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Only one active swap per shift
CREATE UNIQUE INDEX IF NOT EXISTS uq_swap_requests_active ON swap_requests(shift_id)
  WHERE status IN ('open','offered','manager_pending');

CREATE TABLE IF NOT EXISTS swap_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES swap_requests(id) ON DELETE CASCADE,
  offerer_id UUID NOT NULL REFERENCES users(id),
  offer_shift_id UUID REFERENCES shifts(id), -- null when cover for 'give'
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','withdrawn','accepted','rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swap_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('request','offer')),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swap_requests_status ON swap_requests(status);
CREATE INDEX IF NOT EXISTS idx_swap_offers_request_status ON swap_offers(request_id, status);
CREATE INDEX IF NOT EXISTS idx_swap_audit_logs_created_at ON swap_audit_logs(created_at);

COMMIT;

-- Down
-- To rollback this feature:
-- BEGIN;
-- DROP TABLE IF EXISTS swap_audit_logs;
-- DROP TABLE IF EXISTS swap_offers;
-- DROP TABLE IF EXISTS swap_requests;
-- COMMIT;

