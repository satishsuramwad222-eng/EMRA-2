# ShopEase — Full-Stack E-Commerce Website

A complete, deployable e-commerce site: Node.js/Express backend, a file-based
database layer (swappable for Postgres/MySQL), JWT auth, server-side price/stock
enforcement, a plain HTML/CSS/JS storefront + admin panel, PDF invoices, and a
Google Sheets order/return sync via Google Apps Script.

This is a **real backend you run yourself** — not a chat demo. Follow the
steps below to get it running locally, then deploy it (Render, Railway, a VPS,
etc.) when you're ready to go live.

---

## 1. What's included

- **Customer-facing storefront**: home page, category/search/filter shop page,
  product details, cart, wishlist, checkout, order history, order tracking
  timeline, return requests, downloadable PDF invoices.
- **Auth**: register/login/logout, forgot/reset password, profile editing,
  address management, change password. Passwords hashed with bcrypt. Sessions
  via httpOnly JWT cookies.
- **Admin panel** (separate login, separate JWT secret): dashboard with
  live stats and low-stock warnings, product CRUD with image upload,
  order status management, return-request status management.
- **Server-enforced business rules**: prices, stock and GST are always
  computed from the database on the server — the browser can never manipulate
  a price or oversell stock. Stock is decremented atomically at checkout.
- **Configurable GST** (CGST/SGST split), unique ID generation for products/
  orders/returns/tracking, a centralized config file for every shop-level
  setting (company info, WhatsApp number, GST rate, Google Sheets URL).
- **Google Sheets sync**: every order (and every return request) is posted to
  a Google Sheet via a small Apps Script web app, on two separate tabs.
- Fully responsive CSS (desktop/tablet/mobile), floating WhatsApp button,
  professional footer, toast notifications, modals, success animations.

## 2. What's intentionally NOT fully wired up (and why)

Being upfront about this so nothing surprises you at launch:

- **Database**: uses simple JSON files under `data/` instead of Postgres/
  MySQL, so you can run this with zero external services. It's genuinely
  fine for a small shop, but all writes go through `db/store.js` — if you
  outgrow it, that's the one file to reimplement against a real database;
  nothing in `routes/` needs to change.
- **Email**: "Forgot password" generates a real, working reset token, but
  since no email provider is configured, the reset link is currently logged
  to the server console (`[password reset] ...`) instead of emailed. Wire up
  Nodemailer/SES/SendGrid/etc. at the marked `TODO` in `routes/auth.js`.
- **Online payments**: architected but not connected to a real gateway. An
  "online" order is created with `paymentStatus: "pending"` and is never
  marked paid by the client — only a real gateway webhook should do that
  (see the stub at `POST /api/orders/:id/confirm-payment`). Cash on Delivery
  works fully today.
- **Google Sheets sync**: works out of the box once you deploy the included
  Apps Script (step 5 below) and set two environment variables. Until then,
  orders/returns are still saved correctly in the app's own database — they
  just don't also get pushed to a spreadsheet.
- **Image storage**: product images are saved to local disk
  (`public/uploads/`). Fine for a single server; if you deploy to a
  platform with an ephemeral filesystem (e.g. most container platforms),
  point `routes/admin.js`'s multer storage at S3/Cloudinary instead.

## 3. Requirements

- Node.js 18+ (this was built and tested on Node 22)
- npm

## 4. Getting it running locally

```bash
cd shopease
npm install
cp .env.example .env      # then edit .env — see section 6 below
npm run seed               # creates the admin account + 10 sample products
npm start                  # or `npm run dev` to auto-restart on changes
```

Open **http://localhost:4000** for the storefront and
**http://localhost:4000/admin/login.html** for the admin panel.

Default seeded admin login (change immediately, see below):
- Email: whatever you set as `ADMIN_EMAIL` in `.env` (default `admin@yourshop.com`)
- Password: whatever you set as `ADMIN_PASSWORD` in `.env` (default `ChangeMe123!`)

To change the admin password later, log in and use the admin panel, or edit
`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` and re-run `npm run seed` **before**
an admin account already exists (the seed script won't overwrite an existing
admin — delete the row from `data/admins.json` first if you need to reset it).

## 5. Central configuration (change once, applies everywhere)

Everything in section 25 of your original spec — company name, address,
customer care number, WhatsApp number, email, GST number, social links, GST
rate, Google Sheet URL — lives in **`config/config.js`**, which reads from
**`.env`**. Nothing is duplicated elsewhere in the code. To rebrand the site
or change the WhatsApp number, edit `.env` and restart the server.

See `.env.example` for every available setting with comments.

## 6. Google Sheets setup (exact steps)

1. Create a new Google Sheet (sheets.google.com → Blank spreadsheet).
2. In that Sheet: **Extensions → Apps Script**.
3. Delete the placeholder `myFunction() {}` code and paste in the entire
   contents of **`google-apps-script/Code.gs`** from this project.
4. In the Apps Script editor: **Project Settings (gear icon) → Script
   Properties → Add script property**:
   - Property: `SHARED_SECRET`
   - Value: any long random string you choose, e.g. `x7pQ...` (generate one
     with `openssl rand -hex 24` if you like)
5. Back in the editor: **Deploy → New deployment**.
   - Click the gear next to "Select type" → choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then **Authorize access** and approve the permissions
     Google asks for (this is your own script, running under your account).
   - Copy the **Web app URL** it gives you (ends in `/exec`).
6. In this project's `.env` file, set:
   ```
   GOOGLE_SHEETS_WEBAPP_URL=<the web app URL you just copied>
   GOOGLE_SHEETS_SHARED_SECRET=<the same random string as SHARED_SECRET above>
   ```
7. Restart the server (`npm start`). Place a test order — you should see an
   "Orders" tab appear in your Google Sheet with a header row and the order's
   data. Submit a test return request — a "Return Requests" tab will appear
   the same way, kept completely separate from order data.

If sync ever fails (wrong URL, expired deployment, etc.), the order/return is
still saved in the app itself — the customer just gets an honest warning
message and the admin can see `sheetSync: { ok: false, error: ... }` on the
order, rather than the app silently pretending it synced.

## 7. Project structure

```
shopease/
  server.js              Express app entry point
  config/config.js        Centralized settings (reads .env)
  db/
    store.js              Tiny JSON-file data store (swap for a real DB later)
    seed.js                Creates admin + sample products
  middleware/auth.js       Customer JWT guard + separate Admin JWT guard
  routes/
    auth.js                Register/login/logout/forgot-reset password
    profile.js             View/edit profile, address, change password
    products.js             Public catalog: list/search/filter/categories
    cart.js                Server-priced, stock-clamped cart
    wishlist.js             Per-user wishlist
    orders.js               Checkout, order history, tracking
    returns.js              Return requests
    invoice.js               PDF invoice generation
    admin.js                Admin auth, dashboard, product/order/return mgmt
  services/googleSheets.js  Posts orders/returns to the Apps Script web app
  utils/                    ID generation, GST math, input validation
  google-apps-script/Code.gs  Paste-in script for the Google Sheet side
  public/                  The whole frontend (plain HTML/CSS/JS)
    css/styles.css
    js/                    api.js, common.js (shared header/footer/toasts), per-page JS
    js/admin/                Admin panel JS
    admin/                    Admin panel HTML pages
    *.html                    Storefront pages
  data/                    JSON "database" files (created automatically)
```

## 8. Security notes (what's already handled)

- Passwords are hashed with bcrypt — never stored or logged in plain text.
- Customer and admin sessions use **different JWT secrets**, so a stolen
  customer token can never be replayed against an admin route.
- Every price, GST calculation and stock check happens **server-side** in
  `routes/cart.js` and `routes/orders.js` — the client only ever sends a
  product ID and a quantity. Stock is decremented atomically inside a single
  synchronous pass so two simultaneous checkouts can't both oversell the same
  unit.
- All admin routes require a valid admin JWT (`middleware/auth.js`,
  `requireAdmin`); all account/cart/wishlist/order routes require a valid
  customer JWT (`requireAuth`).
- Order placement is idempotent when the frontend sends an `idempotencyKey`
  (already wired up in `checkout.js`), preventing duplicate orders from a
  double-click or network retry.
- Basic input validation/sanitization is applied on every write endpoint
  (`utils/validators.js`).
- Uploaded product images are restricted by file type and size (5MB) via
  multer's file filter.

**Before going to production**, at minimum: set strong random values for
`JWT_SECRET` and `ADMIN_JWT_SECRET` in `.env`, serve the site over HTTPS
(so the `secure` cookie flag applies), and change the seeded admin password.

## 9. Testing checklist

The full flow described in the original spec was manually tested against
this backend during development:

Register → Login → Browse → Search → Filter → Product Details → Wishlist →
Add to Cart → Change Quantity → Checkout → Address validation (blocked
without address, modal shown) → Place Order → Stock reduction verified →
Order confirmation → Google Sheets entry (once configured) → Order tracking
→ Invoice PDF download → Return request → Return sheet entry (separate tab).

Admin: Login → Add Product (with image) → Set Stock → Edit Product → View
Orders → Update Order Status → View Return Requests → Update Return Status →
Dashboard stats reflect all of the above.

Re-run this checklist after any change to `routes/` or `public/js/`.

## 10. Extending it later

- **Real database**: reimplement `db/store.js`'s methods against
  Postgres/MySQL/Mongo — no other file touches the filesystem directly.
- **Payment gateway**: implement `POST /api/orders/:id/confirm-payment` in
  `routes/orders.js` to verify a Razorpay (or other) webhook signature before
  marking `paymentStatus: "paid"`.
- **Email**: replace the `console.log` in `routes/auth.js`'s
  `forgot-password` handler with a real provider call.
- **Multiple saved addresses**: currently one address per user; extend the
  `address` field on the user record to an array and update
  `routes/profile.js` + `checkout.js` accordingly.

---

## Deploying on Netlify

This project is Netlify-ready (`netlify.toml`, `netlify/functions/api.js`).

1. Push the folder to GitHub (the `.env` file is git-ignored) and import the repo in Netlify, or run `npx netlify-cli deploy --prod` from this folder.
2. In Netlify: Site settings > Environment variables > "Import from a .env file", and import your `.env`.
3. Orders, users, products and uploaded images are stored in Netlify Blobs. The `data/*.json` files are only the starting data on first run.
