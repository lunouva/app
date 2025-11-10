-- Employee qualifications per position (for cross-train rules)

BEGIN;

CREATE TABLE IF NOT EXISTS user_positions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_user_positions_position ON user_positions(position_id);

COMMIT;

