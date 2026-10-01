const { collection } = require('../db/store');

const counters = collection('counters');

function nextSeq(key) {
  return counters.mutate((records) => {
    let row = records.find((r) => r.key === key);
    if (!row) {
      row = { key, value: 0 };
      records.push(row);
    }
    row.value += 1;
    return row.value;
  });
}

function pad(num, len) {
  return String(num).padStart(len, '0');
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;
}

// PRD-000001
function generateProductId() {
  return `PRD-${pad(nextSeq('product'), 6)}`;
}

// ORD-20260926-000001
function generateOrderId() {
  return `ORD-${todayStamp()}-${pad(nextSeq('order'), 6)}`;
}

// RET-20260926-000001
function generateReturnId() {
  return `RET-${todayStamp()}-${pad(nextSeq('return'), 6)}`;
}

// TRK-XXXXXXXXXXXX
function generateTrackingId() {
  return `TRK-${pad(nextSeq('tracking'), 8)}`;
}

function generateUserId() {
  return `USR-${pad(nextSeq('user'), 6)}`;
}

module.exports = {
  generateProductId,
  generateOrderId,
  generateReturnId,
  generateTrackingId,
  generateUserId,
};
