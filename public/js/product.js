(async function () {
  await ShopEase.init();
  const container = document.getElementById('product-container');
  const id = new URLSearchParams(location.search).get('id');

  if (!id) {
    container.innerHTML = '<p>Product not specified.</p>';
    return;
  }

  let product;
  try {
    const data = await api(`/api/products/${encodeURIComponent(id)}`);
    product = data.product;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${ShopEase.ICONS.box}<p><strong>Product not found.</strong></p><a class="btn btn-primary" href="/shop.html">Browse products</a></div>`;
    return;
  }

  document.title = `${product.name} — ShopEase`;

  let wishlisted = false;
  if (ShopEase.user) {
    try {
      const w = await api('/api/wishlist');
      wishlisted = w.items.some((i) => i.productId === product.id);
    } catch {}
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:36px; align-items:start;" id="pd-grid">
      <div class="product-thumb" style="border-radius:14px; max-width:520px;">
        <img src="${product.image}" alt="${ShopEase.escapeHtml(product.name)}">
        ${product.discountPercent > 0 ? `<span class="discount-tag">${product.discountPercent}% OFF</span>` : ''}
      </div>
      <div>
        <span class="product-cat">${ShopEase.escapeHtml(product.category)}</span>
        <h1 style="margin:6px 0 4px; font-size:26px;">${ShopEase.escapeHtml(product.name)}</h1>
        <p style="color:var(--gray-500); font-size:13px; margin:0 0 14px;">Product ID: ${product.id}</p>

        <div class="product-price-row" style="margin-bottom:14px;">
          <span class="price-now" style="font-size:26px;">${ShopEase.money(product.discountedPrice)}</span>
          ${product.discountPercent > 0 ? `<span class="price-was" style="font-size:16px;">${ShopEase.money(product.price)}</span>` : ''}
          ${product.discountPercent > 0 ? `<span class="status-pill delivered">Save ${product.discountPercent}%</span>` : ''}
        </div>

        <p style="color:var(--gray-700); line-height:1.7;">${ShopEase.escapeHtml(product.description)}</p>

        <p style="font-size:14px; margin:16px 0;">
          Availability:
          ${product.inStock
            ? `<span class="status-pill delivered">In Stock (${product.stock} available)</span>`
            : `<span class="status-pill cancelled">Out of Stock</span>`}
        </p>

        ${product.inStock ? `
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
          <div class="qty-control">
            <button id="qty-minus">−</button>
            <span id="qty-val">1</span>
            <button id="qty-plus">+</button>
          </div>
          <span style="font-size:12.5px; color:var(--gray-500);">Max ${product.stock} per order</span>
        </div>` : ''}

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-outline" id="add-cart-btn" ${product.inStock ? '' : 'disabled'}>Add to Cart</button>
          <button class="btn btn-accent" id="buy-now-btn" ${product.inStock ? '' : 'disabled'}>Buy Now</button>
          <button class="btn btn-icon" id="wishlist-btn" title="Wishlist" style="border:1px solid var(--gray-300);">
            <span style="display:inline-flex; ${wishlisted ? 'color:var(--red-600)' : ''}">${ShopEase.ICONS.heart}</span>
          </button>
        </div>
      </div>
    </div>
    <style>#pd-grid svg{width:20px;height:20px;fill:none;stroke:currentColor} #wishlist-btn.active svg{fill:var(--red-600);stroke:var(--red-600)}</style>
  `;

  document.getElementById('wishlist-btn').classList.toggle('active', wishlisted);

  let qty = 1;
  const qtyVal = document.getElementById('qty-val');
  document.getElementById('qty-minus')?.addEventListener('click', () => { if (qty > 1) { qty--; qtyVal.textContent = qty; } });
  document.getElementById('qty-plus')?.addEventListener('click', () => { if (qty < product.stock) { qty++; qtyVal.textContent = qty; } else { ShopEase.toast(`Only ${product.stock} in stock.`, 'error'); } });

  async function ensureLoggedIn() {
    await ShopEase.loadUser();
    if (!ShopEase.user) {
      location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return false;
    }
    return true;
  }

  document.getElementById('add-cart-btn')?.addEventListener('click', async () => {
    if (!(await ensureLoggedIn())) return;
    try {
      await api('/api/cart/items', { method: 'POST', body: { productId: product.id, quantity: qty } });
      ShopEase.toast('Added to cart', 'success');
      ShopEase.init();
    } catch (err) { ShopEase.toast(err.message, 'error'); }
  });

  document.getElementById('buy-now-btn')?.addEventListener('click', async () => {
    if (!(await ensureLoggedIn())) return;
    try {
      await api('/api/cart/items', { method: 'POST', body: { productId: product.id, quantity: qty } });
      location.href = '/checkout.html';
    } catch (err) { ShopEase.toast(err.message, 'error'); }
  });

  document.getElementById('wishlist-btn')?.addEventListener('click', async (e) => {
    if (!(await ensureLoggedIn())) return;
    const btn = e.currentTarget;
    try {
      if (btn.classList.contains('active')) {
        await api(`/api/wishlist/${product.id}`, { method: 'DELETE' });
        btn.classList.remove('active');
        ShopEase.toast('Removed from wishlist');
      } else {
        await api(`/api/wishlist/${product.id}`, { method: 'POST' });
        btn.classList.add('active');
        ShopEase.toast('Added to wishlist', 'success');
      }
    } catch (err) { ShopEase.toast(err.message, 'error'); }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth < 760) document.getElementById('pd-grid').style.gridTemplateColumns = '1fr';
  });
  if (window.innerWidth < 760) document.getElementById('pd-grid').style.gridTemplateColumns = '1fr';
})();
