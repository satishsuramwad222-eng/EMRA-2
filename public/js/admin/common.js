// ============================================================================
// Shared admin chrome: sidebar + auth guard. Every admin page (except
// login.html) calls AdminUI.init('pageKey') on load.
// ============================================================================
const AdminUI = (() => {
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(n) { return `₹${Number(n).toLocaleString('en-IN')}`; }

  function toast(message, type = 'info') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', icon: '📊' },
    { key: 'products', label: 'Products', href: '/admin/products.html', icon: '📦' },
    { key: 'orders', label: 'Orders', href: '/admin/orders.html', icon: '🧾' },
    { key: 'returns', label: 'Returns', href: '/admin/returns.html', icon: '↩️' },
  ];

  function renderShell(active, bodyHtml) {
    document.body.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-sidebar">
          <div class="logo">ShopEase<span class="dot" style="color:var(--orange-500)">.</span> Admin</div>
          ${NAV.map((n) => `<a href="${n.href}" class="${active === n.key ? 'active' : ''}">${n.icon} ${n.label}</a>`).join('')}
          <a href="#" id="admin-logout-link" style="margin-top:20px; color:#fca5a5;">🚪 Log Out</a>
        </aside>
        <main class="admin-main" id="admin-main">${bodyHtml}</main>
      </div>`;
    document.getElementById('admin-logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/api/admin/logout', { method: 'POST' });
      location.href = '/admin/login.html';
    });
  }

  async function init(active) {
    try {
      await api('/api/admin/dashboard'); // cheap auth check -- redirects to login if not an admin
    } catch {
      location.href = '/admin/login.html';
      return false;
    }
    const contentEl = document.getElementById('page-content');
    const bodyHtml = contentEl ? contentEl.innerHTML : '';
    renderShell(active, bodyHtml);
    return true;
  }

  return { init, escapeHtml, money, toast };
})();
