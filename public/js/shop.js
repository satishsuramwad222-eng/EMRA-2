(async function () {
  await ShopEase.init('shop');
  const grid = document.getElementById('product-grid');
  ShopEase.wireProductGrid(grid);

  const params = new URLSearchParams(location.search);

  function currentFilters() {
    return {
      category: params.get('category') || '',
      q: params.get('q') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      inStock: params.get('inStock') || '',
      newArrivals: params.get('newArrivals') || '',
      discount: params.get('discount') || '',
      sort: params.get('sort') || '',
    };
  }

  function syncFormFromParams() {
    const f = currentFilters();
    document.getElementById('min-price').value = f.minPrice;
    document.getElementById('max-price').value = f.maxPrice;
    document.getElementById('filter-instock').checked = f.inStock === 'true';
    document.getElementById('filter-new').checked = f.newArrivals === 'true';
    document.getElementById('filter-discount').checked = f.discount === 'true';
    document.getElementById('sort-select').value = f.sort;
    document.getElementById('shop-title').textContent = f.category ? f.category : (f.q ? `Search results for "${f.q}"` : 'All Products');
  }

  async function renderCategoryFilters() {
    const cats = await ShopEase.loadCategories();
    const active = params.get('category') || '';
    const box = document.getElementById('category-filters');
    box.innerHTML = cats.map((c) => `
      <label>
        <input type="radio" name="cat" value="${ShopEase.escapeHtml(c)}" ${active === c ? 'checked' : ''}>
        ${ShopEase.escapeHtml(c)}
      </label>`).join('') + `<label><input type="radio" name="cat" value="" ${active === '' ? 'checked' : ''}> All Categories</label>`;
    box.addEventListener('change', (e) => {
      if (e.target.name === 'cat') {
        setParam('category', e.target.value);
      }
    });
  }

  function setParam(key, value) {
    if (value) params.set(key, value); else params.delete(key);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    load();
  }

  async function load() {
    syncFormFromParams();
    const f = currentFilters();
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    grid.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await api(`/api/products?${qs.toString()}`);
      document.getElementById('result-count').textContent = `${data.count} product${data.count === 1 ? '' : 's'} found`;
      if (data.products.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${ShopEase.ICONS.box}<p><strong>No products found.</strong><br>Try adjusting your filters or search term.</p></div>`;
      } else {
        grid.innerHTML = data.products.map(ShopEase.productCard).join('');
      }
    } catch (err) {
      grid.innerHTML = `<p style="grid-column:1/-1;color:var(--red-600)">${ShopEase.escapeHtml(err.message)}</p>`;
    }
  }

  document.getElementById('apply-price').addEventListener('click', () => {
    params.set('minPrice', document.getElementById('min-price').value || '');
    params.set('maxPrice', document.getElementById('max-price').value || '');
    if (!params.get('minPrice')) params.delete('minPrice');
    if (!params.get('maxPrice')) params.delete('maxPrice');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    load();
  });
  document.getElementById('filter-instock').addEventListener('change', (e) => setParam('inStock', e.target.checked ? 'true' : ''));
  document.getElementById('filter-new').addEventListener('change', (e) => setParam('newArrivals', e.target.checked ? 'true' : ''));
  document.getElementById('filter-discount').addEventListener('change', (e) => setParam('discount', e.target.checked ? 'true' : ''));
  document.getElementById('sort-select').addEventListener('change', (e) => setParam('sort', e.target.value));
  document.getElementById('clear-filters').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    location.reload();
  });

  await renderCategoryFilters();
  await load();
})();
