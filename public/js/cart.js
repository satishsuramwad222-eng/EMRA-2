(async function () {
  await ShopEase.init('cart');
  const container = document.getElementById('cart-container');

  const user = await ShopEase.requireLogin('/cart.html');
  if (!user) return;

  async function render() {
    container.innerHTML = '<div class="spinner"></div>';
    let cart;
    try {
      cart = await api('/api/cart');
    } catch (err) {
      container.innerHTML = `<p style="color:var(--red-600)">${ShopEase.escapeHtml(err.message)}</p>`;
      return;
    }

    if (cart.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${ShopEase.ICONS.cart}
          <p><strong>Your cart is empty.</strong><br>Looks like you haven't added anything yet.</p>
          <a class="btn btn-primary" href="/shop.html">Start Shopping</a>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="cart-layout">
        <div class="panel" id="cart-items"></div>
        <div class="panel">
          <h3 style="margin-top:0;">Order Summary</h3>
          <div class="summary-row"><span>Subtotal</span><span>${ShopEase.money(cart.subtotal)}</span></div>
          <div class="summary-row"><span>CGST</span><span>${ShopEase.money(cart.cgst)}</span></div>
          <div class="summary-row"><span>SGST</span><span>${ShopEase.money(cart.sgst)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${ShopEase.money(cart.total)}</span></div>
          <p class="summary-note">Inclusive of all taxes.</p>
          <a class="btn btn-accent btn-block" style="margin-top:14px;" href="/checkout.html">Proceed to Checkout</a>
        </div>
      </div>`;

    const itemsBox = document.getElementById('cart-items');
    itemsBox.innerHTML = cart.items.map((item) => `
      <div class="cart-item" data-id="${item.productId}">
        <img src="${item.image}" alt="${ShopEase.escapeHtml(item.name)}">
        <div class="cart-item-info">
          <div class="cart-item-name">${ShopEase.escapeHtml(item.name)}</div>
          <div class="cart-item-id">ID: ${item.productId} &nbsp;•&nbsp; ${ShopEase.money(item.unitPrice)} each</div>
          <div class="qty-control">
            <button data-act="minus">−</button>
            <span>${item.quantity}</span>
            <button data-act="plus" ${item.quantity >= item.maxQuantity ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="cart-item-side">
          <div class="cart-item-total">${ShopEase.money(item.lineSubtotal)}</div>
          <button class="remove-link" data-act="remove">Remove</button>
        </div>
      </div>`).join('');

    itemsBox.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const row = btn.closest('.cart-item');
      const productId = row.dataset.id;
      const qtySpan = row.querySelector('.qty-control span');
      const currentQty = Number(qtySpan.textContent);

      try {
        if (btn.dataset.act === 'remove') {
          await api(`/api/cart/items/${productId}`, { method: 'DELETE' });
          ShopEase.toast('Item removed');
        } else {
          const newQty = btn.dataset.act === 'plus' ? currentQty + 1 : currentQty - 1;
          if (newQty < 1) {
            await api(`/api/cart/items/${productId}`, { method: 'DELETE' });
          } else {
            await api(`/api/cart/items/${productId}`, { method: 'PUT', body: { quantity: newQty } });
          }
        }
        await render();
        ShopEase.init('cart');
      } catch (err) {
        ShopEase.toast(err.message, 'error');
      }
    });
  }

  await render();
})();
