(async function () {
  await ShopEase.init('home');

  const CATEGORY_EMOJI = {
    Grocery: '🛒', Electronics: '🎧', Clothes: '👕', Shoes: '👟', Accessories: '👜',
    'Home & Kitchen': '🍳', Beauty: '💄', 'Marriage Cards': '💌', 'Invitation Cards': '🎉',
  };

  const featuredGrid = document.getElementById('featured-grid');
  const newGrid = document.getElementById('new-grid');
  const offersGrid = document.getElementById('offers-grid');
  [featuredGrid, newGrid, offersGrid].forEach((g) => ShopEase.wireProductGrid(g));

  async function loadCategoryGrid() {
    const cats = await ShopEase.loadCategories();
    const box = document.getElementById('category-grid');
    if (!cats.length) { box.innerHTML = ''; return; }
    box.innerHTML = cats.map((c) => `
      <a class="category-chip" href="/shop.html?category=${encodeURIComponent(c)}">
        <span class="emoji">${CATEGORY_EMOJI[c] || '🛍️'}</span>${ShopEase.escapeHtml(c)}
      </a>`).join('');
  }

  async function loadRow(el, query, emptyMsg) {
    try {
      const data = await api(`/api/products?${query}`);
      const list = data.products.slice(0, 4);
      el.innerHTML = list.length ? list.map(ShopEase.productCard).join('') : `<p style="color:var(--gray-500)">${emptyMsg}</p>`;
    } catch {
      el.innerHTML = `<p style="color:var(--gray-500)">${emptyMsg}</p>`;
    }
  }

  await loadCategoryGrid();
  await loadRow(featuredGrid, 'sort=newest', 'No featured products yet.');
  await loadRow(newGrid, 'newArrivals=true', 'No new arrivals yet.');
  await loadRow(offersGrid, 'discount=true', 'No offers right now — check back soon!');
})();
