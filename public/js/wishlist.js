(async function () {
  await ShopEase.init('wishlist');
  const container = document.getElementById('wishlist-container');
  const user = await ShopEase.requireLogin('/wishlist.html');
  if (!user) return;

  async function render() {
    let data;
    try {
      data = await api('/api/wishlist');
    } catch (err) {
      container.innerHTML = `<p style="color:var(--red-600)">${ShopEase.escapeHtml(err.message)}</p>`;
      return;
    }
    if (data.items.length === 0) {
      container.innerHTML = `<div class="empty-state">${ShopEase.ICONS.heart}<p><strong>Your wishlist is empty.</strong></p><a class="btn btn-primary" href="/shop.html">Browse Products</a></div>`;
      return;
    }
    container.innerHTML = `<div class="panel" id="wishlist-list"></div>`;
    const list = document.getElementById('wishlist-list');
    list.innerHTML = data.items.map((i) => `
      <div class="cart-item" data-id="${i.productId}">
        <img src="${i.image}" alt="${ShopEase.escapeHtml(i.name)}">
        <div class="cart-item-info">
          <div class="cart-item-name">${ShopEase.escapeHtml(i.name)}</div>
          <div class="cart-item-id">ID: ${i.productId} • ${ShopEase.money(i.price)}</div>
          ${!i.inStock ? '<span class="status-pill cancelled">Out of Stock</span>' : ''}
        </div>
        <div class="cart-item-side">
          <button class="btn btn-primary btn-sm" data-act="cart" ${i.inStock ? '' : 'disabled'}>Add to Cart</button>
          <button class="remove-link" data-act="remove">Remove</button>
        </div>
      </div>`).join('');

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('.cart-item').dataset.id;
      try {
        if (btn.dataset.act === 'remove') {
          await api(`/api/wishlist/${id}`, { method: 'DELETE' });
          ShopEase.toast('Removed from wishlist');
        } else {
          await api('/api/cart/items', { method: 'POST', body: { productId: id, quantity: 1 } });
          ShopEase.toast('Added to cart', 'success');
        }
        await render();
        ShopEase.init('wishlist');
      } catch (err) { ShopEase.toast(err.message, 'error'); }
    });
  }

  await render();
})();
