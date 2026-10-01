(async function () {
  const ok = await AdminUI.init('products');
  if (!ok) return;

  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  const errEl = document.getElementById('product-form-error');

  async function loadCategoriesIntoDatalist() {
    try {
      const { categories } = await api('/api/products/categories');
      document.getElementById('cat-list').innerHTML = categories.map((c) => `<option value="${AdminUI.escapeHtml(c)}">`).join('');
    } catch {}
  }

  async function loadProducts() {
    const tbody = document.getElementById('products-body');
    tbody.innerHTML = '<tr><td colspan="10">Loading...</td></tr>';
    try {
      const { products } = await api('/api/admin/products');
      if (products.length === 0) { tbody.innerHTML = '<tr><td colspan="10">No products yet.</td></tr>'; return; }
      tbody.innerHTML = products.map((p) => `
        <tr>
          <td><img src="${p.image}" alt=""></td>
          <td>${p.id}</td>
          <td>${AdminUI.escapeHtml(p.name)}</td>
          <td>${AdminUI.escapeHtml(p.category)}</td>
          <td>${AdminUI.money(p.price)}</td>
          <td>${p.stock === 0 ? '<span class="status-pill cancelled">0</span>' : (p.stock <= 5 ? `<span class="status-pill processing">${p.stock}</span>` : p.stock)}</td>
          <td>${p.gstPercent}%</td>
          <td>${p.discountPercent}%</td>
          <td><span class="status-pill ${p.status === 'active' ? 'delivered' : 'cancelled'}">${p.status}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-outline btn-sm" data-act="edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-act="delete" data-id="${p.id}">Delete</button>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="10" style="color:var(--red-600)">${AdminUI.escapeHtml(err.message)}</td></tr>`;
    }
  }

  function openModal(product) {
    errEl.classList.remove('show');
    form.reset();
    document.getElementById('modal-title').textContent = product ? `Edit ${product.id}` : 'Add Product';
    document.getElementById('p-id').value = product ? product.id : '';
    document.getElementById('p-name').value = product ? product.name : '';
    document.getElementById('p-category').value = product ? product.category : '';
    document.getElementById('p-price').value = product ? product.price : '';
    document.getElementById('p-stock').value = product ? product.stock : '';
    document.getElementById('p-gst').value = product ? product.gstPercent : 18;
    document.getElementById('p-discount').value = product ? product.discountPercent : 0;
    document.getElementById('p-status').value = product ? product.status : 'active';
    document.getElementById('p-description').value = product ? product.description : '';
    modal.removeAttribute('hidden');
  }
  function closeModal() { modal.setAttribute('hidden', ''); }

  document.getElementById('add-product-btn').addEventListener('click', () => openModal(null));
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  document.getElementById('products-body').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === 'edit') {
      try {
        const { products } = await api('/api/admin/products');
        const product = products.find((p) => p.id === id);
        openModal(product);
        await loadCategoriesIntoDatalist();
      } catch (err) { AdminUI.toast(err.message, 'error'); }
    } else if (btn.dataset.act === 'delete') {
      if (!confirm(`Delete product ${id}? This cannot be undone.`)) return;
      try {
        await api(`/api/admin/products/${id}`, { method: 'DELETE' });
        AdminUI.toast('Product deleted', 'success');
        loadProducts();
      } catch (err) { AdminUI.toast(err.message, 'error'); }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.remove('show');
    const id = document.getElementById('p-id').value;
    const fd = new FormData();
    fd.append('name', document.getElementById('p-name').value.trim());
    fd.append('category', document.getElementById('p-category').value.trim());
    fd.append('price', document.getElementById('p-price').value);
    fd.append('stock', document.getElementById('p-stock').value);
    fd.append('gstPercent', document.getElementById('p-gst').value);
    fd.append('discountPercent', document.getElementById('p-discount').value);
    fd.append('status', document.getElementById('p-status').value);
    fd.append('description', document.getElementById('p-description').value.trim());
    const fileInput = document.getElementById('p-image');
    if (fileInput.files[0]) fd.append('image', fileInput.files[0]);

    const saveBtn = document.getElementById('modal-save');
    saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
    try {
      if (id) {
        await api(`/api/admin/products/${id}`, { method: 'PUT', body: fd, isForm: true });
      } else {
        await api('/api/admin/products', { method: 'POST', body: fd, isForm: true });
      }
      AdminUI.toast('Product saved', 'success');
      closeModal();
      loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Save Product';
    }
  });

  await loadCategoriesIntoDatalist();
  await loadProducts();
})();
