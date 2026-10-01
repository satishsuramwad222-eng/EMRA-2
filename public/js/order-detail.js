(async function () {
  await ShopEase.init();
  const container = document.getElementById('order-container');
  const user = await ShopEase.requireLogin(location.pathname + location.search);
  if (!user) return;

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { container.innerHTML = '<p>Order not specified.</p>'; return; }

  const FULL_TIMELINE = ['Order Placed', 'Order Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

  function timelineHtml(order) {
    if (order.status === 'Cancelled') {
      return `<p class="status-pill cancelled" style="font-size:14px; padding:8px 16px;">This order was cancelled.</p>`;
    }
    const doneIdx = FULL_TIMELINE.indexOf(order.status);
    const effectiveIdx = doneIdx === -1 ? FULL_TIMELINE.length - 1 : doneIdx; // return states show full progress
    return `<div class="timeline">${FULL_TIMELINE.map((step, i) => {
      const cls = i < effectiveIdx ? 'done' : (i === effectiveIdx ? 'done current' : '');
      return `<div class="timeline-step ${cls}"><span class="timeline-dot"></span><div class="timeline-label">${step}</div></div>`;
    }).join('')}</div>`;
  }

  async function loadReturnEligibility(order) {
    if (order.status !== 'Delivered') return null;
    try {
      const { returns } = await api('/api/returns');
      const already = returns.find((r) => r.orderId === order.id);
      return already || 'eligible';
    } catch { return null; }
  }

  function renderReturnSection(order, eligibility) {
    if (!eligibility) return '';
    if (eligibility !== 'eligible') {
      return `
        <div class="panel" style="margin-top:18px;">
          <h3 style="margin-top:0;">Return Request</h3>
          <p>Status: <span class="status-pill return">${eligibility.status}</span></p>
          <p style="color:var(--gray-500); font-size:13.5px;">Reason: ${ShopEase.escapeHtml(eligibility.reason)}</p>
        </div>`;
    }
    const itemOptions = order.items.map((i) => `<option value="${i.productId}">${ShopEase.escapeHtml(i.name)}</option>`).join('');
    return `
      <div class="panel" style="margin-top:18px;">
        <h3 style="margin-top:0;">Request a Return</h3>
        <div class="form-error" id="return-error"></div>
        <form id="return-form">
          <div class="field"><label>Product</label><select id="ret-product">${itemOptions}</select></div>
          <div class="field"><label>Reason for Return</label>
            <select id="ret-reason">
              <option>Received damaged product</option>
              <option>Wrong item delivered</option>
              <option>Item not as described</option>
              <option>No longer needed</option>
              <option>Other</option>
            </select>
          </div>
          <div class="field"><label>Additional Comments (optional)</label><textarea id="ret-comments" rows="3"></textarea></div>
          <button class="btn btn-outline" type="submit">Submit Return Request</button>
        </form>
      </div>`;
  }

  try {
    const { order } = await api(`/api/orders/${encodeURIComponent(id)}`);
    const eligibility = await loadReturnEligibility(order);

    container.innerHTML = `
      <div class="panel" style="margin-top:18px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="margin:0 0 4px;">${order.id}</h2>
          <span style="color:var(--gray-500); font-size:13px;">Placed on ${new Date(order.createdAt).toLocaleString('en-IN')}</span>
        </div>
        <div style="text-align:right;">
          <span class="status-pill ${ShopEase.statusClass(order.status)}" style="font-size:13px; padding:6px 14px;">${order.status}</span><br>
          <span style="font-size:12px; color:var(--gray-500);">Tracking ID: ${order.trackingId}</span>
        </div>
      </div>

      <div class="panel" style="margin-top:18px;">
        <h3 style="margin-top:0;">Order Tracking</h3>
        ${timelineHtml(order)}
        <p style="color:var(--gray-500); font-size:13px; text-align:center;">Estimated delivery: ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div class="panel" style="margin-top:18px;">
        <h3 style="margin-top:0;">Items</h3>
        ${order.items.map((i) => `
          <div style="display:flex; gap:12px; padding:10px 0; border-bottom:1px solid var(--gray-100);">
            <img src="${i.image}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">
            <div style="flex:1;">
              <div style="font-weight:700; font-size:14px;">${ShopEase.escapeHtml(i.name)}</div>
              <div style="color:var(--gray-500); font-size:12.5px;">ID: ${i.productId} • Qty: ${i.quantity} • ${ShopEase.money(i.price)} each</div>
            </div>
            <strong>${ShopEase.money(i.lineTotal)}</strong>
          </div>`).join('')}
        <div style="margin-top:12px;">
          <div class="summary-row"><span>Subtotal</span><span>${ShopEase.money(order.subtotal)}</span></div>
          <div class="summary-row"><span>CGST</span><span>${ShopEase.money(order.cgst)}</span></div>
          <div class="summary-row"><span>SGST</span><span>${ShopEase.money(order.sgst)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${ShopEase.money(order.total)}</span></div>
        </div>
      </div>

      <div class="panel" style="margin-top:18px;">
        <h3 style="margin-top:0;">Delivery Address</h3>
        <p style="margin:0;">${ShopEase.escapeHtml([order.address.line1, order.address.line2].filter(Boolean).join(', '))}<br>${ShopEase.escapeHtml(order.address.city)}, ${ShopEase.escapeHtml(order.address.state)} - ${ShopEase.escapeHtml(order.address.pincode)}</p>
      </div>

      <div style="margin-top:18px; display:flex; gap:12px;">
        <a class="btn btn-primary" href="/api/invoice/${order.id}" target="_blank">Download Invoice</a>
      </div>

      ${renderReturnSection(order, eligibility)}
    `;

    const returnForm = document.getElementById('return-form');
    if (returnForm) {
      returnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('return-error');
        errEl.classList.remove('show');
        try {
          const res = await api('/api/returns', { method: 'POST', body: {
            orderId: order.id,
            productId: document.getElementById('ret-product').value,
            reason: document.getElementById('ret-reason').value,
            comments: document.getElementById('ret-comments').value,
          }});
          if (res.warning) ShopEase.toast(res.warning, 'error');
          ShopEase.toast('Return request submitted', 'success');
          location.reload();
        } catch (err) {
          errEl.textContent = err.message;
          errEl.classList.add('show');
        }
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${ShopEase.ICONS.box}<p><strong>Order not found.</strong></p></div>`;
  }
})();
