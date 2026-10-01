(async function () {
  const ok = await AdminUI.init('orders');
  if (!ok) return;

  let ORDER_STATUSES = [];
  const params = new URLSearchParams(location.search);

  async function loadStatusFilter() {
    const { statuses } = await api('/api/admin/orders');
    ORDER_STATUSES = statuses;
    const sel = document.getElementById('status-filter');
    sel.innerHTML = '<option value="">All Statuses</option>' + statuses.map((s) => `<option value="${s}">${s}</option>`).join('');
    sel.addEventListener('change', () => loadOrders(sel.value));
  }

  async function loadOrders(status) {
    const tbody = document.getElementById('orders-body');
    tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const { orders } = await api(`/api/admin/orders${qs}`);
      if (orders.length === 0) { tbody.innerHTML = '<tr><td colspan="8">No orders found.</td></tr>'; return; }
      tbody.innerHTML = orders.map((o) => `
        <tr>
          <td>${o.id}</td>
          <td>${o.address.line1 ? AdminUI.escapeHtml(o.address.city) : '-'}</td>
          <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
          <td>${o.items.length}</td>
          <td>${AdminUI.money(o.total)}</td>
          <td>${o.paymentMethod.toUpperCase()} <br><span style="font-size:11px;color:var(--gray-500)">${o.paymentStatus}</span></td>
          <td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td>
          <td><button class="btn btn-outline btn-sm" data-id="${o.id}" data-act="view">View</button></td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red-600)">${AdminUI.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function loadDetail(id) {
    const box = document.getElementById('order-detail-box');
    box.innerHTML = '<div class="panel"><div class="spinner"></div></div>';
    try {
      const { order, customer } = await api(`/api/admin/orders/${id}`);
      box.innerHTML = `
        <div class="panel" style="margin-bottom:20px; border-left:4px solid var(--blue-700);">
          <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; align-items:flex-start;">
            <div>
              <h2 style="margin:0 0 4px;">${order.id}</h2>
              <p style="color:var(--gray-500); font-size:13px; margin:0;">Tracking: ${order.trackingId} • Placed ${new Date(order.createdAt).toLocaleString('en-IN')}</p>
              ${customer ? `<p style="margin:6px 0 0; font-size:13.5px;">${AdminUI.escapeHtml(customer.name)} • ${AdminUI.escapeHtml(customer.mobile)} • ${AdminUI.escapeHtml(customer.email)}</p>` : ''}
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <select class="status-select" id="order-status-select">
                ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button class="btn btn-primary btn-sm" id="update-status-btn">Update</button>
            </div>
          </div>
          <hr style="border:none; border-top:1px solid var(--gray-100); margin:16px 0;">
          ${order.items.map((i) => `
            <div style="display:flex; gap:10px; padding:6px 0; font-size:13.5px;">
              <img src="${i.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
              <span style="flex:1;">${AdminUI.escapeHtml(i.name)} (${i.productId}) × ${i.quantity}</span>
              <strong>${AdminUI.money(i.lineTotal)}</strong>
            </div>`).join('')}
          <p style="font-size:13.5px; color:var(--gray-500); margin-top:10px;">Delivery: ${AdminUI.escapeHtml([order.address.line1, order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', '))}</p>
          <p style="font-size:13px; color:${order.sheetSync && order.sheetSync.ok ? 'var(--green-600)' : 'var(--amber-600)'};">
            Google Sheet sync: ${order.sheetSync && order.sheetSync.attempted ? (order.sheetSync.ok ? '✓ Synced' : `⚠ Failed (${AdminUI.escapeHtml(order.sheetSync.error || 'unknown error')})`) : '— not configured —'}
          </p>
          <button class="btn btn-outline btn-sm" id="close-detail-btn">Close</button>
        </div>`;

      document.getElementById('close-detail-btn').addEventListener('click', () => {
        box.innerHTML = '';
        history.replaceState(null, '', location.pathname);
      });
      document.getElementById('update-status-btn').addEventListener('click', async () => {
        const newStatus = document.getElementById('order-status-select').value;
        try {
          await api(`/api/admin/orders/${order.id}/status`, { method: 'PUT', body: { status: newStatus } });
          AdminUI.toast('Order status updated', 'success');
          loadDetail(id);
          loadOrders(document.getElementById('status-filter').value);
        } catch (err) { AdminUI.toast(err.message, 'error'); }
      });
    } catch (err) {
      box.innerHTML = `<p style="color:var(--red-600)">${AdminUI.escapeHtml(err.message)}</p>`;
    }
  }

  function statusClass(status) {
    const map = { 'Order Placed': 'placed', 'Order Confirmed': 'placed', Processing: 'processing', Packed: 'processing', Shipped: 'shipped', 'Out for Delivery': 'out', Delivered: 'delivered', Cancelled: 'cancelled', 'Return Requested': 'return', Returned: 'return' };
    return map[status] || 'placed';
  }

  document.getElementById('orders-body').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act=view]');
    if (!btn) return;
    history.replaceState(null, '', `${location.pathname}?id=${btn.dataset.id}`);
    loadDetail(btn.dataset.id);
  });

  await loadStatusFilter();
  await loadOrders('');
  const idParam = params.get('id');
  if (idParam) loadDetail(idParam);
})();
