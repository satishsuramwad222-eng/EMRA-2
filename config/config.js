// ============================================================================
// CENTRAL CONFIGURATION
// Every shop-level setting (company info, WhatsApp number, GST, Google Sheets,
// secrets) lives here and nowhere else. Values come from environment
// variables (see .env.example) so you can change them without touching code.
// ============================================================================
require('dotenv').config();

module.exports = {
  // ---- Server ----
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:4000',

  // ---- Auth / security ----
  jwtSecret: process.env.JWT_SECRET || 'CHANGE_ME_dev_only_secret_key',
  jwtExpiresIn: '7d',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || 'CHANGE_ME_dev_only_admin_secret',
  bcryptSaltRounds: 10,

  // Seeded admin login (change the password immediately after first login
  // via the admin panel, or by re-running `npm run seed` with new env vars).
  adminEmail: process.env.ADMIN_EMAIL || 'admin@shopease.example',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',

  // ---- Company / branding (shown in footer, invoices, header) ----
  company: {
    name: process.env.COMPANY_NAME || 'ShopEase',
    tagline: process.env.COMPANY_TAGLINE || 'Everything you need, delivered.',
    address: process.env.COMPANY_ADDRESS || '123 Market Street, Connaught Place, New Delhi, Delhi 110001, India',
    email: process.env.COMPANY_EMAIL || 'support@shopease.example',
    customerCareNumber: process.env.CUSTOMER_CARE_NUMBER || '+91-9999999999',
    supportHours: process.env.SUPPORT_HOURS || 'Mon-Sat, 9:00 AM - 7:00 PM IST',
    gstNumber: process.env.GST_NUMBER || '07ABCDE1234F1Z5',
  },

  // ---- WhatsApp (single source of truth; used by floating button + footer) ----
  whatsappNumber: process.env.WHATSAPP_NUMBER || '919999999999', // no '+', no spaces

  // ---- Social links (leave blank to hide) ----
  social: {
    instagram: process.env.SOCIAL_INSTAGRAM || '',
    facebook: process.env.SOCIAL_FACEBOOK || '',
    youtube: process.env.SOCIAL_YOUTUBE || '',
  },

  // ---- Tax ----
  // Configurable so the shop owner can change the GST rate later without
  // touching business logic. Split evenly into CGST + SGST for intra-state.
  gst: {
    totalPercent: Number(process.env.GST_PERCENT || 18),
  },

  // ---- Delivery ----
  estimatedDeliveryDays: Number(process.env.ESTIMATED_DELIVERY_DAYS || 5),

  // ---- Google Sheets order sync ----
  // Create a Google Apps Script web app (see google-apps-script/Code.gs and
  // README.md for exact steps), deploy it, and paste the resulting web app
  // URL here. Leave blank to disable sheet sync (orders still work locally).
  googleSheets: {
    webAppUrl: process.env.GOOGLE_SHEETS_WEBAPP_URL || '',
    sharedSecret: process.env.GOOGLE_SHEETS_SHARED_SECRET || '', // must match Code.gs
  },

  // ---- Payments ----
  // COD works out of the box. Online payment is architected as a placeholder:
  // an order made with method "online" is created with paymentStatus "pending"
  // and is only marked "paid" by a (currently stubbed) payment-confirmation
  // endpoint, so it's ready to wire up to a real gateway (e.g. Razorpay) later.
  payments: {
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
};
