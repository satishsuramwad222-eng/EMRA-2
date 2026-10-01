const express = require('express');
const bcrypt = require('bcryptjs');
const { collection } = require('../db/store');
const config = require('../config/config');
const { requireAuth } = require('../middleware/auth');
const { isEmail, isMobile, isNonEmptyString, sanitizeText } = require('../utils/validators');

const router = express.Router();
const users = collection('users');

function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

router.use(requireAuth);

router.get('/', (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

router.put('/', (req, res) => {
  const { name, email, mobile } = req.body || {};
  const patch = {};
  if (name !== undefined) {
    if (!isNonEmptyString(name, 100)) return res.status(400).json({ error: 'Please enter a valid name.' });
    patch.name = sanitizeText(name);
  }
  if (email !== undefined) {
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    const emailLower = email.trim().toLowerCase();
    const clash = users.findOne((u) => u.email === emailLower && u.id !== req.user.id);
    if (clash) return res.status(409).json({ error: 'That email is already in use.' });
    patch.email = emailLower;
  }
  if (mobile !== undefined) {
    if (!isMobile(mobile)) return res.status(400).json({ error: 'Please enter a valid mobile number.' });
    patch.mobile = mobile.trim();
  }
  const updated = users.update(req.user.id, patch);
  res.json({ user: publicUser(updated) });
});

// Add/edit delivery address. Kept simple (one saved address per user) to
// match the "add address before ordering" flow in the spec; extend to a list
// of addresses later if you need multiple saved addresses.
router.put('/address', (req, res) => {
  const a = req.body || {};
  if (!isNonEmptyString(a.line1, 200) || !isNonEmptyString(a.city, 100) ||
      !isNonEmptyString(a.state, 100) || !isNonEmptyString(a.pincode, 12)) {
    return res.status(400).json({ error: 'Please fill in address line 1, city, state and pincode.' });
  }
  const address = {
    line1: sanitizeText(a.line1),
    line2: sanitizeText(a.line2 || ''),
    city: sanitizeText(a.city),
    state: sanitizeText(a.state),
    pincode: sanitizeText(a.pincode),
    country: sanitizeText(a.country || 'India'),
  };
  const updated = users.update(req.user.id, { address });
  res.json({ user: publicUser(updated) });
});

router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword) || newPassword.length < 8) {
    return res.status(400).json({ error: 'Please provide your current password and a new password (min 8 chars).' });
  }
  const user = users.findById(req.user.id);
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  const passwordHash = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
  users.update(req.user.id, { passwordHash });
  res.json({ ok: true, message: 'Password changed successfully.' });
});

module.exports = router;
