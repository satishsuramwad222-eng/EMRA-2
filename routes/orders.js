const express = require('express');
const { collection } = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const { calculateGst, round2 } = require('../utils/gst');
const { generateOrderId, generateTrackingId } = require('../utils/idGenerator');
const { syncOrderToSheet } = require('../services/googleSheets');
const config = require('../config/config');

const router = express.Router();
const users = collection('users');
const products = collection('products');
const carts = collection('carts');
const orders = collection('orders');
const idempotency = collection('order_idempotency_keys');

const ORDER_STATUSES = [
  'Order Placed', 'Order Confirmed', 'Processing', 'Packed', 'Shipped',
  'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned',
];

router.use(requireAuth);

// ---- Place order ----
// Validates address, re-checks stock and re-prices every item from the
// product database (never trusts client-sent prices/quantities), atomically
// decrements stock, then creates the order. Only after the order object is
// safely written do we attempt to clear the cart and sync to Google Sheets.
router.post('/', async (req, res) => {
  const { paymentMethod, idempotencyKey } = req.body || {};
  const method = paymentMethod === 'online' ? 'online' : 'cod';

  const user = users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  // Spec section 2 / 6: block placing an order without a saved address.
  if (!user.address || !user.address.line1) {
    return res.status(400).json({
      error: 'ADDRESS_REQUIRED',
      message: 'Please add your delivery address before placing the order.',
    });
  }

  // Prevent duplicate submissions (e.g. double-click, network retry).
  if (idempotencyKey) {
    const dupe = idempotency.findOne((k) => k.userId === req.user.id && k.key === idempotencyKey);
    if (dupe) {
      const existing = orders.findById(dupe.orderId);
      return res.status(200).json({ order: existing, deduplicated: true });
    }
  }

  const cart = carts.findOne((c) => c.userId === req.user.id);
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Re-validate stock & compute authoritative line items in one atomic pass
  // over the products collection, so two simultaneous checkouts can't both
  // succeed against stock that only covers one of them.
  let stockError = null;
  let lineItems = [];
  products.mutate((allProducts) => {
    for (const cartItem of cart.items) {
      const product = allProducts.find((p) => p.id === cartItem.productId);
      if (!product || product.status !== 'active') {
        stockError = 'One of the items in your cart is no longer available.';
        return;
      }
      if (product.stock < cartItem.quantity) {
        stockError = `Sorry, "${product.name}" only has ${product.stock} left in stock.`;
        return;
      }
    }
    if (stockError) return;

    // All good -- decrement stock now, and build the priced line items from
    // the same authoritative product records.
    for (const cartItem of cart.items) {
      const product = allProducts.find((p) => p.id === cartItem.productId);
      const unitPrice = product.discountPercent > 0
        ? round2((product.price * (100 - product.discountPercent)) / 100)
        : product.price;
      const lineSubtotal = round2(unitPrice * cartItem.quantity);
      const gst = calculateGst(lineSubtotal, product.gstPercent);

      lineItems.push({
        productId: product.id,
        name: product.name,
        image: product.image,
        category: product.category,
        price: unitPrice,
        quantity: cartItem.quantity,
        gstPercent: gst.percent,
        cgst: gst.cgst,
        sgst: gst.sgst,
        lineTotal: gst.total,
        lineSubtotal,
      });

      product.stock -= cartItem.quantity;
    }
  });

  if (stockError) return res.status(400).json({ error: stockError });

  const subtotal = round2(lineItems.reduce((s, i) => s + i.lineSubtotal, 0));
  const gstTotals = lineItems.reduce(
    (acc, i) => ({ cgst: round2(acc.cgst + i.cgst), sgst: round2(acc.sgst + i.sgst) }),
    { cgst: 0, sgst: 0 }
  );
  const total = round2(subtotal + gstTotals.cgst + gstTotals.sgst);

  const now = new Date();
  const eta = new Date(now.getTime() + config.estimatedDeliveryDays * 24 * 60 * 60 * 1000);

  const order = {
    id: generateOrderId(),
    userId: user.id,
    items: lineItems,
    subtotal,
    cgst: gstTotals.cgst,
    sgst: gstTotals.sgst,
    total,
    address: user.address,
    paymentMethod: method,
    // Online payments start "pending" and are only flipped to "paid" by a
    // real payment-gateway confirmation webhook (see routes/orders.js
    // POST /:id/confirm-payment stub) -- never marked successful client-side.
    paymentStatus: method === 'cod' ? 'pending_cod' : 'pending',
    status: 'Order Placed',
    statusHistory: [{ status: 'Order Placed', at: now.toISOString() }],
    trackingId: generateTrackingId(),
    estimatedDelivery: eta.toISOString(),
    sheetSync: { attempted: false, ok: false },
    createdAt: now.toISOString(),
  };
  orders.insert(order);

  if (idempotencyKey) {
    idempotency.insert({ userId: req.user.id, key: idempotencyKey, orderId: order.id, at: now.toISOString() });
  }

  // Clear the cart now that the order is safely persisted.
  carts.mutate((records) => {
    const c = records.find((r) => r.userId === req.user.id);
    if (c) c.items = [];
  });

  // Sync to Google Sheets. A failure here does NOT roll back the order (the
  // order is real and stock is already committed) but we do NOT pretend it
  // synced -- we log it and surface a warning flag on the response so the
  // admin/customer aren't misled, per spec section 27.
  let sheetWarning = null;
  try {
    const result = await syncOrderToSheet(order, user);
    orders.update(order.id, { sheetSync: { attempted: true, ok: !!result.ok, error: result.error || null } });
    if (result.skipped) {
      sheetWarning = 'Google Sheets sync is not configured; order was saved locally only.';
    } else if (!result.ok) {
      sheetWarning = 'Order placed, but syncing to the order spreadsheet failed. The team has been notified.';
      console.error(`[order ${order.id}] Google Sheets sync failed:`, result.error);
    }
  } catch (err) {
    orders.update(order.id, { sheetSync: { attempted: true, ok: false, error: err.message } });
    sheetWarning = 'Order placed, but syncing to the order spreadsheet failed.';
    console.error(`[order ${order.id}] Google Sheets sync threw:`, err);
  }

  res.status(201).json({ order: orders.findById(order.id), warning: sheetWarning });
});

router.get('/', (req, res) => {
  const mine = orders.find((o) => o.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders: mine });
});

router.get('/:id', (req, res) => {
  const order = orders.findById(req.params.id);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order });
});

router.get('/:id/track', (req, res) => {
  const order = orders.findById(req.params.id);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  res.json({
    trackingId: order.trackingId,
    currentStatus: order.status,
    statusHistory: order.statusHistory,
    estimatedDelivery: order.estimatedDelivery,
    timeline: ['Order Placed', 'Order Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'],
  });
});

// Placeholder confirmation endpoint for a future real payment gateway
// (e.g. Razorpay webhook). Intentionally does nothing destructive yet.
router.post('/:id/confirm-payment', (req, res) => {
  const order = orders.findById(req.params.id);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  return res.status(501).json({
    error: 'Payment gateway is not connected yet. Configure RAZORPAY_KEY_ID/SECRET and implement gateway verification here before enabling online payments.',
  });
});

module.exports = router;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
