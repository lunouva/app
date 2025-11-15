-- Core ShiftMate schema: locations, users, positions, schedules, shifts,
-- shift_assignments, availability, time_off_requests.
-- Designed to work with swap_offers / swap_claims and user_positions
-- defined in later migrations.

BEGIN;

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Locations (per-store / business unit)
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users (employees, managers, owners)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('owner','manager','employee')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Positions within a location (e.g., Cashier, Barista)
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

-- Weekly schedules per location
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  week_start date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, week_start)
);

-- Individual shifts on a schedule
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  break_min integer NOT NULL DEFAULT 0 CHECK (break_min >= 0),
  notes text,
  CHECK (ends_at > starts_at)
);

-- Assignment of users to shifts
CREATE TABLE IF NOT EXISTS shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  UNIQUE (shift_id, user_id)
);

-- Canonical weekly availability blocks per user
CREATE TABLE IF NOT EXISTS availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  note text,
  CHECK (end_time > start_time)
);

-- Time-off requests
CREATE TABLE IF NOT EXISTS time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  date_from date NOT NULL,
  date_to date NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','denied')) DEFAULT 'pending',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from)
);

-- Helpful indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id);
CREATE INDEX IF NOT EXISTS idx_positions_location ON positions(location_id);
CREATE INDEX IF NOT EXISTS idx_schedules_location_week ON schedules(location_id, week_start);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule ON shifts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_shifts_position ON shifts(position_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user ON shift_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_user_weekday ON availability(user_id, weekday);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_user ON time_off_requests(user_id);

COMMIT;

-- Down
-- BEGIN;
-- DROP TABLE IF EXISTS time_off_requests;
-- DROP TABLE IF EXISTS availability;
-- DROP TABLE IF EXISTS shift_assignments;
-- DROP TABLE IF EXISTS shifts;
-- DROP TABLE IF EXISTS schedules;
-- DROP TABLE IF EXISTS positions;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS locations;
-- COMMIT;

