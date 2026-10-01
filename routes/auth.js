const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { collection } = require('../db/store');
const config = require('../config/config');
const { requireAuth } = require('../middleware/auth');
const { generateUserId } = require('../utils/idGenerator');
const { isEmail, isMobile, isNonEmptyString, sanitizeText } = require('../utils/validators');

const router = express.Router();
const users = collection('users');
const resets = collection('password_resets');

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.nodeEnv === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// ---- Register ----
router.post('/register', async (req, res) => {
  const { name, email, mobile, password, address } = req.body || {};

  if (!isNonEmptyString(name, 100)) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!isMobile(mobile)) return res.status(400).json({ error: 'Please enter a valid mobile number.' });
  if (!isNonEmptyString(password) || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const emailLower = email.trim().toLowerCase();
  if (users.findOne((u) => u.email === emailLower)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

  const user = {
    id: generateUserId(),
    name: sanitizeText(name),
    email: emailLower,
    mobile: mobile.trim(),
    passwordHash,
    address: address && typeof address === 'object'
      ? {
          line1: sanitizeText(address.line1 || ''),
          line2: sanitizeText(address.line2 || ''),
          city: sanitizeText(address.city || ''),
          state: sanitizeText(address.state || ''),
          pincode: sanitizeText(address.pincode || ''),
          country: sanitizeText(address.country || 'India'),
        }
      : null,
    createdAt: new Date().toISOString(),
  };
  users.insert(user);

  const token = issueToken(user);
  res.cookie('token', token, COOKIE_OPTS);
  res.status(201).json({ user: publicUser(user), token });
});

// ---- Login (email or mobile) ----
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!isNonEmptyString(identifier) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'Please enter your email/mobile and password.' });
  }
  const idLower = identifier.trim().toLowerCase();
  const user = users.findOne((u) => u.email === idLower || u.mobile === identifier.trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

  const token = issueToken(user);
  res.cookie('token', token, COOKIE_OPTS);
  res.json({ user: publicUser(user), token });
});

// ---- Logout ----
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ---- Current user ----
router.get('/me', requireAuth, (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

// ---- Forgot password ----
// Generates a single-use, 30-minute reset token. NOTE: sending real email
// requires an SMTP/email provider, which isn't configured in this project.
// For now the reset link is logged to the server console so you can test the
// full flow locally; wire up Nodemailer (or any provider) in the marked spot
// below before going live.
router.post('/forgot-password', (req, res) => {
  const { identifier } = req.body || {};
  if (!isNonEmptyString(identifier)) return res.status(400).json({ error: 'Please enter your email or mobile.' });
  const idLower = identifier.trim().toLowerCase();
  const user = users.findOne((u) => u.email === idLower || u.mobile === identifier.trim());

  // Always respond the same way whether or not the account exists, so the
  // endpoint can't be used to check which emails are registered.
  const genericResponse = { ok: true, message: 'If an account exists, a password reset link has been sent.' };
  if (!user) return res.json(genericResponse);

  const token = crypto.randomBytes(32).toString('hex');
  resets.insert({
    id: token,
    userId: user.id,
    expiresAt: Date.now() + 30 * 60 * 1000,
    used: false,
  });

  const resetLink = `${config.publicUrl}/reset-password.html?token=${token}`;
  // TODO: replace this console.log with a real email/SMS send (Nodemailer, SES, Twilio, etc.)
  console.log(`[password reset] ${user.email} -> ${resetLink}`);

  res.json(genericResponse);
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!isNonEmptyString(token) || !isNonEmptyString(password) || password.length < 8) {
    return res.status(400).json({ error: 'Invalid request. Password must be at least 8 characters.' });
  }
  const record = resets.findById(token);
  if (!record || record.used || record.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  users.update(record.userId, { passwordHash });
  resets.update(token, { used: true });
  res.json({ ok: true, message: 'Password updated. You can now log in.' });
});

module.exports = router;
