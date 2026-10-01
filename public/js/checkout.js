(async function () {
  await ShopEase.init('checkout');
  const container = document.getElementById('checkout-container');
  const user = await ShopEase.requireLogin('/checkout.html');
  if (!user) return;

  function getIdempotencyKey() {
    let key = sessionStorage.getItem('checkout_idempotency_key');
    if (!key) {
      key = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      sessionStorage.setItem('checkout_idempotency_key', key);
    }
    return key;
  }
  function resetIdempotencyKey() {
    sessionStorage.removeItem('checkout_idempotency_key');
  }

  async function render() {
    let cart, me;
    try {
      [cart, me] = await Promise.all([api('/api/cart'), api('/api/profile')]);
    } catch (err) {
      container.innerHTML = `<p style="color:var(--red-600)">${ShopEase.escapeHtml(err.message)}</p>`;
      return;
    }

    if (cart.items.length === 0) {
      container.innerHTML = `<div class="empty-state">${ShopEase.ICONS.cart}<p><strong>Your cart is empty.</strong></p><a class="btn btn-primary" href="/shop.html">Browse Products</a></div>`;
      return;
    }

    const addr = me.user.address;
    const addressHtml = addr
      ? `<p style="margin:0;">${ShopEase.escapeHtml(me.user.name)}<br>${ShopEase.escapeHtml([addr.line1, addr.line2].filter(Boolean).join(', '))}<br>${ShopEase.escapeHtml(addr.city)}, ${ShopEase.escapeHtml(addr.state)} - ${ShopEase.escapeHtml(addr.pincode)}<br>${ShopEase.escapeHtml(me.user.mobile)}</p>`
      : `<p style="color:var(--red-600); margin:0 0 10px;">No delivery address saved yet.</p>`;

    container.innerHTML = `
      <div class="cart-layout">
        <div>
          <div class="panel" style="margin-bottom:18px;">
            <h3 style="margin-top:0; display:flex; justify-content:space-between; align-items:center;">
              Delivery Address
              <a href="/profile.html?addAddress=1" class="btn btn-outline btn-sm">${addr ? 'Change' : 'Add Address'}</a>
            </h3>
            ${addressHtml}
          </div>

          <div class="panel" style="margin-bottom:18px;">
            <h3 style="margin-top:0;">Payment Method</h3>
            <label style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer;">
              <input type="radio" name="pay" value="cod" checked> Cash on Delivery
            </label>
            <label style="display:flex; align-items:center; gap:10px; padding:10px 0; cursor:pointer;">
              <input type="radio" name="pay" value="online"> Pay Online (Card / UPI / Netbanking)
              <span class="status-pill processing">Coming soon</span>
            </label>
          </div>

          <div class="panel">
            <h3 style="margin-top:0;">Items (${cart.items.length})</h3>
            ${cart.items.map((i) => `
              <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--gray-100); font-size:14px;">
                <span>${ShopEase.escapeHtml(i.name)} × ${i.quantity}</span>
                <span>${ShopEase.money(i.lineSubtotal)}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="panel">
          <h3 style="margin-top:0;">Order Summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${ShopEase.money(cart.subtotal)}</span></div>
          <div class="summary-row"><span>CGST</span><span>${ShopEase.money(cart.cgst)}</span></div>
          <div class="summary-row"><span>SGST</span><span>${ShopEase.money(cart.sgst)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${ShopEase.money(cart.total)}</span></div>
          <button class="btn btn-accent btn-block" style="margin-top:16px;" id="place-order-btn">Place Order</button>
        </div>
      </div>`;

    document.getElementById('place-order-btn').addEventListener('click', async () => {
      const btn = document.getElementById('place-order-btn');
      const method = document.querySelector('input[name=pay]:checked').value;
      if (method === 'online') {
        ShopEase.toast('Online payment isn\'t connected yet — please choose Cash on Delivery for now.', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Placing order...';
      try {
        const res = await api('/api/orders', { method: 'POST', body: { paymentMethod: method, idempotencyKey: getIdempotencyKey() } });
        resetIdempotencyKey();
        if (res.warning) ShopEase.toast(res.warning, 'error');
        renderSuccess(res.order);
        ShopEase.init('checkout');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Place Order';
        if (err.data && err.data.error === 'ADDRESS_REQUIRED') {
          ShopEase.showAddressRequiredModal();
        } else {
          ShopEase.toast(err.message, 'error');
        }
      }
    });
  }

  function renderSuccess(order) {
    const eta = new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    container.innerHTML = `
      <div class="success-box panel">
        <div class="success-check">${ShopEase.ICONS.check}</div>
        <h2 style="margin:0 0 6px;">Order Placed Successfully!</h2>
        <p style="color:var(--gray-500); margin-bottom:24px;">Thank you for shopping with us.</p>
        <div class="panel" style="background:var(--gray-50); text-align:left; margin-bottom:24px;">
          <div class="summary-row"><span>Order ID</span><strong>${order.id}</strong></div>
          <div class="summary-row"><span>Order Date</span><span>${new Date(order.createdAt).toLocaleString('en-IN')}</span></div>
          <div class="summary-row"><span>Expected Delivery</span><span>${eta}</span></div>
          <div class="summary-row total"><span>Total Paid</span><span>${ShopEase.money(order.total)}</span></div>
        </div>
        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
          <a class="btn btn-outline" href="/shop.html">Continue Shopping</a>
          <a class="btn btn-primary" href="/order-detail.html?id=${order.id}">Track Order</a>
        </div>
      </div>`;
  }

  await render();
})();
