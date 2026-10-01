const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[+]?[0-9]{10,15}$/;

function isEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

function isMobile(v) {
  return typeof v === 'string' && MOBILE_RE.test(v.trim());
}

function isNonEmptyString(v, maxLen = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= maxLen;
}

function isPositiveNumber(v) {
  return typeof v === 'number' && isFinite(v) && v >= 0;
}

// Strips HTML tags and trims. Not a full sanitizer, but stops the obvious
// stored-XSS vector of raw <script> tags in names/descriptions/reviews.
function sanitizeText(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/<[^>]*>/g, '').trim();
}

module.exports = {
  isEmail,
  isMobile,
  isNonEmptyString,
  isPositiveNumber,
  sanitizeText,
};
