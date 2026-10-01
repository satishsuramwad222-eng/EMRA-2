// ============================================================================
// Shared chrome: header (logo/search/nav/cart/wishlist), footer, WhatsApp
// button, toast notifications, and a small address-required modal.
// Every storefront page includes this file plus api.js, then calls
// ShopEase.init('activePageKey') once the DOM is ready.
// ============================================================================
const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.7-4.35-9.3-8.1C.8 9.7 1.7 6 5 5c2-.6 3.8.2 5 2 1.2-1.8 3-2.6 5-2 3.3 1 4.2 4.7 2.3 7.9C18.7 16.65 12 21 12 21z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.4"/><circle cx="19" cy="21" r="1.4"/><path d="M2 3h2l2.6 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L21 7H6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  whatsapp: '<svg viewBox="0 0 32 32"><path d="M16 3C9 3 3.2 8.8 3.2 15.8c0 2.5.7 4.8 1.9 6.8L3 29l6.6-2c1.9 1 4.1 1.6 6.4 1.6 7 0 12.8-5.8 12.8-12.8S23 3 16 3zm0 23.3c-2 0-3.9-.5-5.5-1.5l-.4-.2-3.9 1.2 1.2-3.8-.3-.4a10.5 10.5 0 01-1.6-5.6C5.5 9.9 10.2 5.3 16 5.3S26.5 9.9 26.5 15.8 21.8 26.3 16 26.3zm5.9-7.8c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6 0-.2-.7-1.8-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.3 2.4 3.7 5.9 5.1.8.3 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
};

const ShopEase = (() => {
  let CONFIG = null;
  let CURRENT_USER = null;
  let CATEGORIES = [];

  async function loadConfig() {
    if (CONFIG) return CONFIG;
    try { CONFIG = await api('/api/config'); } catch { CONFIG = { company: { name: 'ShopEase' }, whatsappNumber: '', social: {} }; }
    return CONFIG;
  }

  async function loadUser() {
    try {
      const data = await api('/api/auth/me');
      CURRENT_USER = data.user;
    } catch {
      CURRENT_USER = null;
    }
    return CURRENT_USER;
  }

  async function loadCategories() {
    try {
      const data = await api('/api/products/categories');
      CATEGORIES = data.categories;
    } catch { CATEGORIES = []; }
    return CATEGORIES;
  }

  async function cartCount() {
    if (!CURRENT_USER) return 0;
    try { const c = await api('/api/cart'); return c.items.reduce((s, i) => s + i.quantity, 0); } catch { return 0; }
  }
  async function wishlistCount() {
    if (!CURRENT_USER) return 0;
    try { const w = await api('/api/wishlist'); return w.items.length; } catch { return 0; }
  }

  function toast(message, type = 'info') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  // ---- Address-required modal (spec section 2 & 6) ----
  function showAddressRequiredModal() {
    let overlay = document.getElementById('address-required-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'address-required-modal';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box">
          <h2>Delivery address required</h2>
          <p>Please add your delivery address before placing the order.</p>
          <div class="modal-actions">
            <button class="btn btn-outline" id="addr-modal-cancel">Cancel</button>
            <a class="btn btn-primary" href="/profile.html?addAddress=1">Add Address</a>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#addr-modal-cancel').addEventListener('click', () => overlay.setAttribute('hidden', ''));
    }
    overlay.removeAttribute('hidden');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function statusClass(status) {
    const map = {
      'Order Placed': 'placed', 'Order Confirmed': 'placed', Processing: 'processing', Packed: 'processing',
      Shipped: 'shipped', 'Out for Delivery': 'out', Delivered: 'delivered', Cancelled: 'cancelled',
      'Return Requested': 'return', Returned: 'return', 'Return Approved': 'return', 'Refund Completed': 'return',
      'Return Rejected': 'rejected',
    };
    return map[status] || 'placed';
  }

  async function renderHeader(active) {
    const container = document.getElementById('site-header');
    if (!container) return;
    const cfg = await loadConfig();
    await loadUser();
    await loadCategories();
    const [cCount, wCount] = await Promise.all([cartCount(), wishlistCount()]);

    const cats = CATEGORIES.length ? CATEGORIES : ['Grocery', 'Electronics', 'Clothes', 'Shoes', 'Accessories', 'Home & Kitchen', 'Beauty', 'Marriage Cards', 'Invitation Cards'];
    const catLinks = cats.map((c) => `<li><a href="/shop.html?category=${encodeURIComponent(c)}">${escapeHtml(c)}</a></li>`).join('');

    const params = new URLSearchParams(location.search);
    const q = params.get('q') || '';

    container.innerHTML = `
      <header class="site-header">
        <div class="container header-top">
          <a href="/index.html" class="logo">${escapeHtml(cfg.company.name)}<span class="dot">.</span></a>
          <form class="search-bar" action="/shop.html" method="get">
            <input type="text" name="q" placeholder="Search products, categories or Product ID..." value="${escapeHtml(q)}" aria-label="Search">
            <button type="submit" aria-label="Search">${ICONS.search}</button>
          </form>
          <nav class="header-actions">
            <a class="header-action" href="/wishlist.html">${ICONS.heart}<span>Wishlist</span>${wCount ? `<span class="badge">${wCount}</span>` : ''}</a>
            <a class="header-action" href="/cart.html">${ICONS.cart}<span>Cart</span>${cCount ? `<span class="badge">${cCount}</span>` : ''}</a>
            <a class="header-action" href="${CURRENT_USER ? '/profile.html' : '/login.html'}">${ICONS.user}<span>${CURRENT_USER ? 'Account' : 'Login'}</span></a>
            <button class="hamburger" id="hamburger-btn" aria-label="Menu">${ICONS.menu}</button>
          </nav>
        </div>
        <div class="mobile-menu" id="mobile-menu">
          <a href="/index.html">Home</a>
          <a href="/shop.html">All Products</a>
          ${cats.slice(0, 8).map((c) => `<a href="/shop.html?category=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join('')}
          <a href="/orders.html">My Orders</a>
          ${CURRENT_USER ? '' : '<a href="/register.html">Create Account</a>'}
        </div>
        <div class="categories-bar">
          <div class="container"><ul>
            <li><a href="/shop.html" class="${active === 'shop' ? 'active' : ''}">All Products</a></li>
            ${catLinks}
          </ul></div>
        </div>
      </header>`;

    document.getElementById('hamburger-btn').addEventListener('click', () => {
      document.getElementById('mobile-menu').classList.toggle('open');
    });
  }

  async function renderFooter() {
    const container = document.getElementById('site-footer');
    if (!container) return;
    const cfg = await loadConfig();
    const social = cfg.social || {};
    container.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div class="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="/about.html">About Us</a></li>
              <li><a href="/contact.html">Contact Us</a></li>
              <li><a href="/privacy-policy.html">Privacy Policy</a></li>
              <li><a href="/terms.html">Terms &amp; Conditions</a></li>
              <li><a href="/return-policy.html">Return Policy</a></li>
              <li><a href="/shipping-policy.html">Shipping Policy</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Customer Support</h4>
            <ul>
              <li>Care: ${escapeHtml(cfg.company.customerCareNumber)}</li>
              <li>Email: ${escapeHtml(cfg.company.email)}</li>
              <li>WhatsApp: +${escapeHtml(cfg.whatsappNumber)}</li>
              <li>${escapeHtml(cfg.company.supportHours || '')}</li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Our Address</h4>
            <ul><li>${escapeHtml(cfg.company.address)}</li></ul>
          </div>
          <div class="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/index.html">Home</a></li>
              <li><a href="/shop.html">Products</a></li>
              <li><a href="/cart.html">Cart</a></li>
              <li><a href="/wishlist.html">Wishlist</a></li>
              <li><a href="/orders.html">My Orders</a></li>
            </ul>
            <div class="footer-social">
              ${social.instagram ? `<a href="${social.instagram}" target="_blank" rel="noopener">IG</a>` : ''}
              ${social.facebook ? `<a href="${social.facebook}" target="_blank" rel="noopener">FB</a>` : ''}
              ${social.youtube ? `<a href="${social.youtube}" target="_blank" rel="noopener">YT</a>` : ''}
            </div>
          </div>
        </div>
        <div class="footer-bottom">&copy; ${new Date().getFullYear()} ${escapeHtml(cfg.company.name)}. All rights reserved.</div>
      </footer>`;
  }

  async function renderWhatsApp() {
    const cfg = await loadConfig();
    if (!cfg.whatsappNumber) return;
    const fab = document.createElement('a');
    fab.className = 'whatsapp-fab';
    fab.href = `https://wa.me/${cfg.whatsappNumber}`;
    fab.target = '_blank';
    fab.rel = 'noopener';
    fab.setAttribute('aria-label', 'Chat on WhatsApp');
    fab.innerHTML = ICONS.whatsapp;
    document.body.appendChild(fab);
  }

  async function init(active) {
    await renderHeader(active);
    await renderFooter();
    await renderWhatsApp();
  }

  async function requireLogin(redirectTo) {
    await loadUser();
    if (!CURRENT_USER) {
      const next = encodeURIComponent(redirectTo || location.pathname + location.search);
      location.href = `/login.html?next=${next}`;
      return null;
    }
    return CURRENT_USER;
  }

  function money(n) {
    return `₹${Number(n).toLocaleString('en-IN')}`;
  }

  function productCard(p) {
    const outOfStock = !p.inStock;
    const hasDiscount = p.discountPercent > 0;
    return `
      <div class="product-card" data-product-id="${p.id}">
        <div class="product-thumb">
          <a href="/product.html?id=${encodeURIComponent(p.id)}"><img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy"></a>
          ${hasDiscount ? `<span class="discount-tag">${p.discountPercent}% OFF</span>` : ''}
          <button class="wishlist-btn" data-action="wishlist" data-id="${p.id}" aria-label="Add to wishlist">${ICONS.heart}</button>
          ${outOfStock ? '<span class="stock-tag">Out of Stock</span>' : ''}
        </div>
        <div class="product-body">
          <span class="product-cat">${escapeHtml(p.category)}</span>
          <a href="/product.html?id=${encodeURIComponent(p.id)}" class="product-name">${escapeHtml(p.name)}</a>
          <span class="product-id">ID: ${p.id}</span>
          <div class="product-price-row">
            <span class="price-now">${money(p.discountedPrice)}</span>
            ${hasDiscount ? `<span class="price-was">${money(p.price)}</span>` : ''}
          </div>
          <div class="product-actions">
            <button class="btn btn-outline btn-sm" data-action="cart" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>Add to Cart</button>
            <a class="btn btn-primary btn-sm" href="/product.html?id=${encodeURIComponent(p.id)}">View</a>
          </div>
        </div>
      </div>`;
  }

  // Event delegation for wishlist-heart and add-to-cart buttons inside any
  // container of rendered product cards.
  function wireProductGrid(container) {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      await loadUser();
      if (!CURRENT_USER) { location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
      const id = btn.dataset.id;
      try {
        if (btn.dataset.action === 'wishlist') {
          if (btn.classList.contains('active')) {
            await api(`/api/wishlist/${id}`, { method: 'DELETE' });
            btn.classList.remove('active');
            toast('Removed from wishlist');
          } else {
            await api(`/api/wishlist/${id}`, { method: 'POST' });
            btn.classList.add('active');
            toast('Added to wishlist', 'success');
          }
          renderHeader();
        } else if (btn.dataset.action === 'cart') {
          await api('/api/cart/items', { method: 'POST', body: { productId: id, quantity: 1 } });
          toast('Added to cart', 'success');
          renderHeader();
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  return {
    init, loadConfig, loadUser, loadCategories, toast, showAddressRequiredModal,
    escapeHtml, statusClass, requireLogin, money, productCard, wireProductGrid, ICONS,
    get user() { return CURRENT_USER; },
  };
})();
