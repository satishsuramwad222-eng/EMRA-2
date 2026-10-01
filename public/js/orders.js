(async function () {
  await ShopEase.init();
  const container = document.getElementById('orders-container');
  const user = await ShopEase.requireLogin('/orders.html');
  if (!user) return;

  try {
    const { orders } = await api('/api/orders');
    if (orders.length === 0) {
      container.innerHTML = `<div class="empty-state">${ShopEase.ICONS.box}<p><strong>You haven't placed any orders yet.</strong></p><a class="btn btn-primary" href="/shop.html">Start Shopping</a></div>`;
      return;
    }
    container.innerHTML = orders.map((o) => `
      <a class="panel" href="/order-detail.html?id=${o.id}" style="display:flex; gap:16px; align-items:center; margin-bottom:14px; text-decoration:none;">
        <img src="${o.items[0].image}" alt="" style="width:64px; height:64px; object-fit:cover; border-radius:8px; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:14.5px;">${o.id}</div>
          <div style="color:var(--gray-500); font-size:13px;">${o.items.length} item${o.items.length > 1 ? 's' : ''} • Placed on ${new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
        </div>
        <span class="status-pill ${ShopEase.statusClass(o.status)}">${o.status}</span>
        <strong style="min-width:90px; text-align:right;">${ShopEase.money(o.total)}</strong>
      </a>`).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--red-600)">${ShopEase.escapeHtml(err.message)}</p>`;
  }
})();
