const config = require('../config/config');

// Rounds to 2 decimal places to avoid floating point artefacts in money math.
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Given a taxable subtotal, returns the GST split using the rate configured
 * centrally in config/config.js (config.gst.totalPercent), so the shop owner
 * can change the rate in one place without touching this logic.
 */
function calculateGst(subtotal, percentOverride) {
  const percent = typeof percentOverride === 'number' ? percentOverride : config.gst.totalPercent;
  const totalGst = round2((subtotal * percent) / 100);
  const cgst = round2(totalGst / 2);
  const sgst = round2(totalGst - cgst); // avoids rounding drift
  return { percent, cgst, sgst, totalGst, total: round2(subtotal + totalGst) };
}

module.exports = { calculateGst, round2 };
