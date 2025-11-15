// Auth routes: login + current user profile.

const { Router } = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signUser, requireAuth } = require('../auth');

const router = Router();

// POST /api/login { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  try {
    const result = await db.query(
      'SELECT id, full_name, email, role, location_id, hashed_password FROM users WHERE email = $1 AND is_active = true LIMIT 1',
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.hashed_password) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const ok = await bcrypt.compare(password, user.hashed_password);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = signUser(user);
    const { hashed_password, ...safeUser } = user;

    return res.json({
      token,
      user: safeUser,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('login error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, role, location_id FROM users WHERE id = $1 AND is_active = true',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json({ user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('me error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

