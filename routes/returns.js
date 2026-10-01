const express = require('express');
const { collection } = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const { generateReturnId } = require('../utils/idGenerator');
const { syncReturnToSheet, formatAddress } = require('../services/googleSheets');
const { isNonEmptyString, sanitizeText } = require('../utils/validators');

const router = express.Router();
const orders = collection('orders');
const returns = collection('returns');
const users = collection('users');

const RETURN_STATUSES = [
  'Return Requested', 'Return Approved', 'Pickup Scheduled', 'Product Received',
  'Refund Processing', 'Refund Completed', 'Return Rejected',
];

router.use(requireAuth);

router.post('/', async (req, res) => {
  const { orderId, productId, reason, comments } = req.body || {};
  if (!isNonEmptyString(orderId) || !isNonEmptyString(productId) || !isNonEmptyString(reason, 500)) {
    return res.status(400).json({ error: 'Please select an order, product and reason for return.' });
  }

  const order = orders.findById(orderId);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'Delivered') {
    return res.status(400).json({ error: 'Only delivered orders are eligible for a return request.' });
  }
  const item = order.items.find((i) => i.productId === productId);
  if (!item) return res.status(400).json({ error: 'That product is not part of this order.' });

  const user = users.findById(req.user.id);
  const now = new Date().toISOString();

  const ret = {
    id: generateReturnId(),
    orderId: order.id,
    productId,
    userId: req.user.id,
    customerName: user.name,
    mobile: user.mobile,
    email: user.email,
    address: formatAddress(order.address),
    reason: sanitizeText(reason),
    comments: sanitizeText(comments || ''),
    productImage: item.image,
    productName: item.name,
    orderAmount: item.lineTotal,
    status: 'Return Requested',
    statusHistory: [{ status: 'Return Requested', at: now }],
    createdAt: now,
  };
  returns.insert(ret);

  // Bump the order status too so it's visible in the customer's order list.
  orders.update(order.id, {
    status: 'Return Requested',
    statusHistory: [...order.statusHistory, { status: 'Return Requested', at: now }],
  });

  let warning = null;
  try {
    const result = await syncReturnToSheet(ret);
    if (!result.ok && !result.skipped) {
      warning = 'Return request saved, but syncing to the returns spreadsheet failed.';
      console.error(`[return ${ret.id}] Sheet sync failed:`, result.error);
    }
  } catch (err) {
    warning = 'Return request saved, but syncing to the returns spreadsheet failed.';
    console.error(`[return ${ret.id}] Sheet sync threw:`, err);
  }

  res.status(201).json({ return: ret, warning });
});

router.get('/', (req, res) => {
  const mine = returns.find((r) => r.userId === req.user.id);
  res.json({ returns: mine });
});

router.get('/:id', (req, res) => {
  const ret = returns.findById(req.params.id);
  if (!ret || ret.userId !== req.user.id) return res.status(404).json({ error: 'Return request not found.' });
  res.json({ return: ret });
});

module.exports = router;
module.exports.RETURN_STATUSES = RETURN_STATUSES;
