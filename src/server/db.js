// Minimal Postgres helper for the ShiftMate API.
// Expects DATABASE_URL in the environment, e.g.:
//   postgres://user:password@localhost:5432/shiftmate

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};

