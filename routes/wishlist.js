const express = require('express');
const { collection } = require('../db/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const wishlists = collection('wishlists');
const products = collection('products');

router.use(requireAuth);

router.get('/', (req, res) => {
  const entries = wishlists.find((w) => w.userId === req.user.id);
  const items = entries
    .map((w) => {
      const p = products.findById(w.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        inStock: p.stock > 0,
        addedAt: w.addedAt,
      };
    })
    .filter(Boolean);
  res.json({ items });
});

router.post('/:productId', (req, res) => {
  const product = products.findById(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const already = wishlists.findOne((w) => w.userId === req.user.id && w.productId === req.params.productId);
  if (!already) {
    wishlists.insert({ userId: req.user.id, productId: req.params.productId, addedAt: new Date().toISOString() });
  }
  res.status(201).json({ ok: true });
});

router.delete('/:productId', (req, res) => {
  wishlists.mutate((records) => {
    const idx = records.findIndex((w) => w.userId === req.user.id && w.productId === req.params.productId);
    if (idx !== -1) records.splice(idx, 1);
  });
  res.json({ ok: true });
});

module.exports = router;
