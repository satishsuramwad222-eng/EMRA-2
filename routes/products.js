const express = require('express');
const { collection } = require('../db/store');

const router = express.Router();
const products = collection('products');

function toPublicProduct(p) {
  const price = p.price;
  const discounted = p.discountPercent > 0 ? Math.round((price * (100 - p.discountPercent)) / 100) : price;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price,
    discountPercent: p.discountPercent || 0,
    discountedPrice: discounted,
    description: p.description,
    image: p.image,
    stock: p.stock,
    inStock: p.stock > 0,
    gstPercent: p.gstPercent,
    status: p.status,
    createdAt: p.createdAt,
  };
}

// GET /api/products?category=&minPrice=&maxPrice=&inStock=true&newArrivals=true&discount=true&q=&sort=
router.get('/', (req, res) => {
  const { category, minPrice, maxPrice, inStock, newArrivals, discount, q, sort } = req.query;

  let list = products.find((p) => p.status === 'active');

  if (category) {
    list = list.filter((p) => p.category.toLowerCase() === String(category).toLowerCase());
  }
  if (minPrice) list = list.filter((p) => p.price >= Number(minPrice));
  if (maxPrice) list = list.filter((p) => p.price <= Number(maxPrice));
  if (inStock === 'true') list = list.filter((p) => p.stock > 0);
  if (discount === 'true') list = list.filter((p) => (p.discountPercent || 0) > 0);
  if (newArrivals === 'true') {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // last 30 days
    list = list.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
  }
  if (q) {
    const term = String(q).trim().toLowerCase();
    list = list.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term)
    );
  }

  if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
  else if (sort === 'newest') list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ products: list.map(toPublicProduct), count: list.length });
});

// GET /api/products/categories - dynamic category list derived from products,
// so the admin can add a brand new category just by using it on a product.
router.get('/categories', (req, res) => {
  const all = products.find((p) => p.status === 'active');
  const categories = [...new Set(all.map((p) => p.category))].sort();
  res.json({ categories });
});

router.get('/:id', (req, res) => {
  const product = products.findOne((p) => p.id === req.params.id && p.status === 'active');
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: toPublicProduct(product) });
});

module.exports = router;
