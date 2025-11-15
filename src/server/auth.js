// JWT-based auth layer for ShiftMate API.
// - Parses Authorization: Bearer <token>
// - Attaches req.user = { id, role, location_id }

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-shiftmate-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signUser(user) {
  const payload = {
    userId: user.id,
    role: user.role,
    locationId: user.location_id,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function extractToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return match[1].trim();
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.userId,
      role: payload.role,
      location_id: payload.locationId,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

function requireManager(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'owner' || role === 'manager') {
    return next();
  }
  return res.status(403).json({ error: 'forbidden' });
}

module.exports = {
  signUser,
  requireAuth,
  requireManager,
};

