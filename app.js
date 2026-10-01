const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/config');
const store = require('./db/store');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const returnRoutes = require('./routes/returns');
const invoiceRoutes = require('./routes/invoice');
const adminRoutes = require('./routes/admin');

const app = express();

// On Netlify the data lives in Netlify Blobs; this loads it before each request
// and saves it before the response is sent. Locally it is a no-op.
app.use(store.middleware);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- Public config values the frontend needs (never leaks secrets) ----
app.get('/api/config', (req, res) => {
  res.json({
    company: config.company,
    whatsappNumber: config.whatsappNumber,
    social: config.social,
    gstPercent: config.gst.totalPercent,
    estimatedDeliveryDays: config.estimatedDeliveryDays,
  });
});

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/admin', adminRoutes);

// ---- Uploaded product images (served from Netlify Blobs when on Netlify) ----
app.get('/uploads/:name', require('./utils/uploads').serveUpload);

// ---- Static frontend ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- 404 for unknown API routes ----
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ---- Central error handler ----
// Catches thrown errors (including multer upload errors) so the client always
// gets a clean JSON error instead of a raw stack trace or a hung request.
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image is too large (max 5MB).' });
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

module.exports = app;
