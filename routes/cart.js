const express = require('express');
const { collection } = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const { calculateGst, round2 } = require('../utils/gst');

const router = express.Router();
const carts = collection('carts');
const products = collection('products');

router.use(requireAuth);

function getOrCreateCart(userId) {
  let cart = carts.findOne((c) => c.userId === userId);
  if (!cart) {
    cart = { userId, items: [] };
    carts.insert(cart);
  }
  return cart;
}

// Builds the response cart with live product data and server-computed totals.
// Prices, discounts and GST are ALWAYS read from the product record on the
// server -- the client only ever sends productId + quantity (spec section 23:
// never trust price/quantity from the browser).
function hydrateCart(cart) {
  const items = [];
  let changed = false;

  for (const item of cart.items) {
    const product = products.findById(item.productId);
    if (!product || product.status !== 'active') {
      changed = true; // product removed/deactivated since being added
      continue;
    }
    const clampedQty = Math.max(1, Math.min(item.quantity, product.stock));
    if (clampedQty !== item.quantity) changed = true;
    if (clampedQty < 1) continue;

    const unitPrice = product.discountPercent > 0
      ? round2((product.price * (100 - product.discountPercent)) / 100)
      : product.price;
    const lineSubtotal = round2(unitPrice * clampedQty);

    items.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      category: product.category,
      unitPrice,
      quantity: clampedQty,
      maxQuantity: product.stock,
      gstPercent: product.gstPercent,
      lineSubtotal,
    });
  }

  if (changed) {
    cart.items = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    carts.writeAll(carts.readAll().map((c) => (c.userId === cart.userId ? cart : c)));
  }

  const subtotal = round2(items.reduce((sum, i) => sum + i.lineSubtotal, 0));

  // Sum each line's own GST (matches exactly how the order will be priced at
  // checkout) rather than applying one flat rate to the whole cart subtotal.
  let cgst = 0;
  let sgst = 0;
  for (const item of items) {
    const lineGst = calculateGst(item.lineSubtotal, item.gstPercent);
    cgst = round2(cgst + lineGst.cgst);
    sgst = round2(sgst + lineGst.sgst);
  }
  const total = round2(subtotal + cgst + sgst);

  return { items, subtotal, cgst, sgst, total };
}

router.get('/', (req, res) => {
  const cart = getOrCreateCart(req.user.id);
  res.json(hydrateCart(cart));
});

router.post('/items', (req, res) => {
  const { productId, quantity } = req.body || {};
  const qty = Number(quantity) || 1;
  const product = products.findById(productId);
  if (!product || product.status !== 'active') return res.status(404).json({ error: 'Product not found.' });
  if (product.stock <= 0) return res.status(400).json({ error: 'Sorry, this product is currently out of stock.' });

  const cart = getOrCreateCart(req.user.id);
  const existing = cart.items.find((i) => i.productId === productId);
  const desiredQty = (existing ? existing.quantity : 0) + qty;
  const finalQty = Math.min(desiredQty, product.stock);

  if (existing) existing.quantity = finalQty;
  else cart.items.push({ productId, quantity: finalQty });

  carts.mutate((records) => {
    const c = records.find((r) => r.userId === req.user.id);
    if (c) c.items = cart.items;
  });

  res.json(hydrateCart(cart));
});

router.put('/items/:productId', (req, res) => {
  const { quantity } = req.body || {};
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).json({ error: 'Quantity must be at least 1.' });

  const product = products.findById(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (qty > product.stock) {
    return res.status(400).json({ error: `Only ${product.stock} left in stock.`, maxQuantity: product.stock });
  }

  const cart = getOrCreateCart(req.user.id);
  const item = cart.items.find((i) => i.productId === req.params.productId);
  if (!item) return res.status(404).json({ error: 'Item not in cart.' });
  item.quantity = qty;

  carts.mutate((records) => {
    const c = records.find((r) => r.userId === req.user.id);
    if (c) c.items = cart.items;
  });

  res.json(hydrateCart(cart));
});

router.delete('/items/:productId', (req, res) => {
  const cart = getOrCreateCart(req.user.id);
  cart.items = cart.items.filter((i) => i.productId !== req.params.productId);

  carts.mutate((records) => {
    const c = records.find((r) => r.userId === req.user.id);
    if (c) c.items = cart.items;
  });

  res.json(hydrateCart(cart));
});

router.delete('/', (req, res) => {
  carts.mutate((records) => {
    const c = records.find((r) => r.userId === req.user.id);
    if (c) c.items = [];
  });
  res.json(hydrateCart(getOrCreateCart(req.user.id)));
});

module.exports = router;
