const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { collection } = require('../db/store');
const config = require('../config/config');
const { requireAdmin } = require('../middleware/auth');
const { generateProductId } = require('../utils/idGenerator');
const { isNonEmptyString, isPositiveNumber, sanitizeText } = require('../utils/validators');
const { persistUpload, IS_NETLIFY, MAX_UPLOAD_BYTES } = require('../utils/uploads');
const { ORDER_STATUSES } = require('./orders');
const { RETURN_STATUSES } = require('./returns');

const router = express.Router();
const admins = collection('admins');
const products = collection('products');
const orders = collection('orders');
const returns = collection('returns');
const users = collection('users');

// ---- Image upload config ----
// Stores files on local disk under public/uploads. For a production
// deployment behind multiple instances, swap this for S3/Cloudinary storage
// -- routes only depend on the resulting `image` URL string, not on how it's
// stored.
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
const storage = IS_NETLIFY ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only image files (jpg, png, webp, gif) are allowed.'), ok);
  },
});

// ============================================================================
// ADMIN AUTH -- completely separate login, token secret and role check from
// customer auth, so no customer session can ever reach admin routes.
// ============================================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'Please enter email and password.' });
  }
  const admin = admins.findOne((a) => a.email === email.trim().toLowerCase());
  if (!admin) return res.status(401).json({ error: 'Invalid admin credentials.' });
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid admin credentials.' });

  const token = jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' }, config.adminJwtSecret, {
    expiresIn: '12h',
  });
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

// Everything below requires a valid admin session.
router.use(requireAdmin);

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================
router.get('/dashboard', (req, res) => {
  const allProducts = products.readAll();
  const allOrders = orders.readAll();
  const allReturns = returns.readAll();
  const allUsers = users.readAll();

  const pending = allOrders.filter((o) => !['Delivered', 'Cancelled', 'Returned'].includes(o.status)).length;
  const completed = allOrders.filter((o) => o.status === 'Delivered').length;
  const cancelled = allOrders.filter((o) => o.status === 'Cancelled').length;
  const totalSales = allOrders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((s, o) => s + o.total, 0);
  const lowStock = allProducts.filter((p) => p.status === 'active' && p.stock > 0 && p.stock <= 5);
  const outOfStock = allProducts.filter((p) => p.status === 'active' && p.stock === 0);

  res.json({
    totalProducts: allProducts.length,
    totalOrders: allOrders.length,
    pendingOrders: pending,
    completedOrders: completed,
    cancelledOrders: cancelled,
    returnRequests: allReturns.length,
    totalCustomers: allUsers.length,
    totalSales: Math.round(totalSales * 100) / 100,
    lowStockProducts: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    outOfStockCount: outOfStock.length,
    recentOrders: [...allOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
  });
});

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================
router.get('/products', (req, res) => {
  res.json({ products: products.readAll() });
});

router.post('/products', upload.single('image'), persistUpload, (req, res) => {
  const { name, category, price, description, stock, gstPercent, discountPercent, status } = req.body || {};
  if (!isNonEmptyString(name, 150)) return res.status(400).json({ error: 'Product name is required.' });
  if (!isNonEmptyString(category, 80)) return res.status(400).json({ error: 'Category is required.' });
  if (!isPositiveNumber(Number(price))) return res.status(400).json({ error: 'Valid price is required.' });
  if (!Number.isInteger(Number(stock)) || Number(stock) < 0) return res.status(400).json({ error: 'Valid stock quantity is required.' });

  const product = {
    id: generateProductId(),
    name: sanitizeText(name),
    category: sanitizeText(category),
    price: Number(price),
    description: sanitizeText(description || ''),
    image: req.file ? `/uploads/${req.file.filename}` : (req.body.imageUrl || '/img/placeholder-product.svg'),
    stock: Number(stock),
    gstPercent: gstPercent !== undefined ? Number(gstPercent) : config.gst.totalPercent,
    discountPercent: discountPercent ? Number(discountPercent) : 0,
    status: status === 'inactive' ? 'inactive' : 'active',
    createdAt: new Date().toISOString(),
  };
  products.insert(product);
  res.status(201).json({ product });
});

router.put('/products/:id', upload.single('image'), persistUpload, (req, res) => {
  const existing = products.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const { name, category, price, description, stock, gstPercent, discountPercent, status, imageUrl } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = sanitizeText(name);
  if (category !== undefined) patch.category = sanitizeText(category);
  if (price !== undefined) patch.price = Number(price);
  if (description !== undefined) patch.description = sanitizeText(description);
  if (stock !== undefined) patch.stock = Number(stock);
  if (gstPercent !== undefined) patch.gstPercent = Number(gstPercent);
  if (discountPercent !== undefined) patch.discountPercent = Number(discountPercent);
  if (status !== undefined) patch.status = status === 'inactive' ? 'inactive' : 'active';
  if (req.file) patch.image = `/uploads/${req.file.filename}`;
  else if (imageUrl) patch.image = imageUrl;

  const updated = products.update(req.params.id, patch);
  res.json({ product: updated });
});

router.delete('/products/:id', (req, res) => {
  const ok = products.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
});

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================
router.get('/orders', (req, res) => {
  const { status } = req.query;
  let list = orders.readAll();
  if (status) list = list.filter((o) => o.status === status);
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders: list, statuses: ORDER_STATUSES });
});

router.get('/orders/:id', (req, res) => {
  const order = orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const customer = users.findById(order.userId);
  res.json({ order, customer: customer ? { name: customer.name, email: customer.email, mobile: customer.mobile } : null });
});

router.put('/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid order status.' });
  const order = orders.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const now = new Date().toISOString();
  const updated = orders.update(req.params.id, {
    status,
    statusHistory: [...order.statusHistory, { status, at: now }],
  });
  res.json({ order: updated });
});

// ============================================================================
// RETURN REQUEST MANAGEMENT
// ============================================================================
router.get('/returns', (req, res) => {
  res.json({ returns: returns.readAll(), statuses: RETURN_STATUSES });
});

router.put('/returns/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!RETURN_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid return status.' });
  const ret = returns.findById(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Return request not found.' });

  const now = new Date().toISOString();
  const updated = returns.update(req.params.id, {
    status,
    statusHistory: [...ret.statusHistory, { status, at: now }],
  });

  // Reflect final "Returned" state back onto the order too.
  if (status === 'Refund Completed') {
    const order = orders.findById(ret.orderId);
    if (order) {
      orders.update(order.id, {
        status: 'Returned',
        statusHistory: [...order.statusHistory, { status: 'Returned', at: now }],
      });
    }
  }

  res.json({ return: updated });
});

// ============================================================================
// CUSTOMERS (read-only list for admin reference)
// ============================================================================
router.get('/customers', (req, res) => {
  const list = users.readAll().map(({ passwordHash, ...safe }) => safe);
  res.json({ customers: list });
});

module.exports = router;
