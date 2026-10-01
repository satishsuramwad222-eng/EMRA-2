(async function () {
  const ok = await AdminUI.init('returns');
  if (!ok) return;

  let RETURN_STATUSES = [];

  async function load() {
    const tbody = document.getElementById('returns-body');
    tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    try {
      const { returns, statuses } = await api('/api/admin/returns');
      RETURN_STATUSES = statuses;
      if (returns.length === 0) { tbody.innerHTML = '<tr><td colspan="8">No return requests yet.</td></tr>'; return; }
      tbody.innerHTML = returns.map((r) => `
        <tr>
          <td>${r.id}</td>
          <td>${r.orderId}</td>
          <td><img src="${r.productImage}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:8px;">${AdminUI.escapeHtml(r.productName)}</td>
          <td>${AdminUI.escapeHtml(r.customerName)}<br><span style="font-size:11.5px;color:var(--gray-500)">${AdminUI.escapeHtml(r.mobile)}</span></td>
          <td style="max-width:180px;">${AdminUI.escapeHtml(r.reason)}</td>
          <td>${AdminUI.money(r.orderAmount)}</td>
          <td><span class="status-pill return">${r.status}</span></td>
          <td>
            <select class="status-select" data-id="${r.id}">
              ${RETURN_STATUSES.map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('');

      tbody.querySelectorAll('select[data-id]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          try {
            await api(`/api/admin/returns/${sel.dataset.id}/status`, { method: 'PUT', body: { status: sel.value } });
            AdminUI.toast('Return status updated', 'success');
            load();
          } catch (err) { AdminUI.toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red-600)">${AdminUI.escapeHtml(err.message)}</td></tr>`;
    }
  }

  await load();
})();
