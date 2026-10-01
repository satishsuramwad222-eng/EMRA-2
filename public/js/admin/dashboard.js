(async function () {
  const ok = await AdminUI.init('dashboard');
  if (!ok) return;

  try {
    const d = await api('/api/admin/dashboard');

    document.getElementById('stat-grid').innerHTML = `
      <div class="stat-card"><div class="label">Total Products</div><div class="value">${d.totalProducts}</div></div>
      <div class="stat-card"><div class="label">Total Orders</div><div class="value">${d.totalOrders}</div></div>
      <div class="stat-card warn"><div class="label">Pending Orders</div><div class="value">${d.pendingOrders}</div></div>
      <div class="stat-card"><div class="label">Completed Orders</div><div class="value">${d.completedOrders}</div></div>
      <div class="stat-card danger"><div class="label">Cancelled Orders</div><div class="value">${d.cancelledOrders}</div></div>
      <div class="stat-card"><div class="label">Return Requests</div><div class="value">${d.returnRequests}</div></div>
      <div class="stat-card"><div class="label">Total Customers</div><div class="value">${d.totalCustomers}</div></div>
      <div class="stat-card"><div class="label">Total Sales</div><div class="value">${AdminUI.money(d.totalSales)}</div></div>
      <div class="stat-card ${d.lowStockProducts.length ? 'warn' : ''}"><div class="label">Low Stock Items</div><div class="value">${d.lowStockProducts.length}</div></div>
      <div class="stat-card ${d.outOfStockCount ? 'danger' : ''}"><div class="label">Out of Stock</div><div class="value">${d.outOfStockCount}</div></div>
    `;

    if (d.lowStockProducts.length) {
      const warnBox = document.createElement('div');
      warnBox.className = 'panel';
      warnBox.style.marginBottom = '20px';
      warnBox.style.borderLeft = '4px solid var(--amber-600)';
      warnBox.innerHTML = `<h3 style="margin-top:0; color:var(--amber-600);">⚠ Low Stock Warning</h3>
        <ul style="padding-left:18px;">${d.lowStockProducts.map((p) => `<li>${AdminUI.escapeHtml(p.name)} — only <strong>${p.stock}</strong> left (${p.id})</li>`).join('')}</ul>`;
      document.getElementById('stat-grid').after(warnBox);
    }

    document.getElementById('recent-orders-body').innerHTML = d.recentOrders.length
      ? d.recentOrders.map((o) => `
        <tr>
          <td><a href="/admin/orders.html?id=${o.id}" style="color:var(--blue-700); font-weight:700;">${o.id}</a></td>
          <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
          <td><span class="status-pill ${statusClass(o.status)}">${o.status}</span></td>
          <td>${AdminUI.money(o.total)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4">No orders yet.</td></tr>';
  } catch (err) {
    AdminUI.toast(err.message, 'error');
  }

  function statusClass(status) {
    const map = { 'Order Placed': 'placed', 'Order Confirmed': 'placed', Processing: 'processing', Packed: 'processing', Shipped: 'shipped', 'Out for Delivery': 'out', Delivered: 'delivered', Cancelled: 'cancelled', 'Return Requested': 'return', Returned: 'return' };
    return map[status] || 'placed';
  }
})();
