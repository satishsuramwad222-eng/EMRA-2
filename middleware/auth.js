const jwt = require('jsonwebtoken');
const config = require('../config/config');

function getTokenFromRequest(req, cookieName) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies && req.cookies[cookieName]) return req.cookies[cookieName];
  return null;
}

// Requires a logged-in customer. Blocks account/order/wishlist/cart routes
// from unauthorized access, per spec section 1.
function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req, 'token');
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

// Optional auth: attaches req.user if a valid token is present, but does not
// block the request if absent (used for pages that work for guests too).
function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req, 'token');
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
  } catch (err) {
    // ignore invalid/expired token for optional auth
  }
  next();
}

// Requires a logged-in admin. Uses a *different* secret than customer auth
// so a stolen customer token can never be replayed against admin routes.
function requireAdmin(req, res, next) {
  const token = getTokenFromRequest(req, 'admin_token');
  if (!token) return res.status(401).json({ error: 'Admin login required.' });
  try {
    const payload = jwt.verify(token, config.adminJwtSecret);
    if (payload.role !== 'admin') throw new Error('not admin');
    req.admin = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin session.' });
  }
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
