-- User auth fields and notes for seeding demo users.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hashed_password text;

COMMIT;

-- Down
-- BEGIN;
-- ALTER TABLE users DROP COLUMN IF EXISTS hashed_password;
-- COMMIT;

-- Demo seeding notes:
-- To create an initial owner/manager user with a hashed password:
-- 1) Generate a bcrypt hash in Node (from this repo root):
--      npx node -e "console.log(require('bcryptjs').hashSync('changeme123', 10))"
-- 2) Insert a location row (capture the id):
--      INSERT INTO locations (name) VALUES ('Demo Location') RETURNING id;
-- 3) Insert the user, using the returned location id and the bcrypt hash:
--      INSERT INTO users (location_id, full_name, email, role, hashed_password)
--      VALUES ('<location_id>', 'Demo Owner', 'owner@example.com', 'owner', '<bcrypt_hash>');

