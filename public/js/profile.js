(async function () {
  await ShopEase.init();
  const user = await ShopEase.requireLogin('/profile.html');
  if (!user) return;

  const container = document.getElementById('profile-container');
  const wantsAddAddress = new URLSearchParams(location.search).get('addAddress') === '1';

  function render(u) {
    const addr = u.address || {};
    container.innerHTML = `
      <div class="panel" style="margin-bottom:18px;">
        <h3 style="margin-top:0;">Profile Information</h3>
        <div class="form-error" id="profile-error"></div>
        <form id="profile-form">
          <div class="field-row">
            <div class="field"><label>Full Name</label><input type="text" id="p-name" value="${ShopEase.escapeHtml(u.name)}" required></div>
            <div class="field"><label>Mobile Number</label><input type="tel" id="p-mobile" value="${ShopEase.escapeHtml(u.mobile)}" required></div>
          </div>
          <div class="field"><label>Email ID</label><input type="email" id="p-email" value="${ShopEase.escapeHtml(u.email)}" required></div>
          <button class="btn btn-primary" type="submit">Save Changes</button>
        </form>
      </div>

      <div class="panel" style="margin-bottom:18px;" id="address-panel">
        <h3 style="margin-top:0;">Delivery Address</h3>
        <div class="form-error" id="address-error"></div>
        <form id="address-form">
          <div class="field"><label>Address Line 1</label><input type="text" id="a-line1" value="${ShopEase.escapeHtml(addr.line1 || '')}" required></div>
          <div class="field"><label>Address Line 2 (optional)</label><input type="text" id="a-line2" value="${ShopEase.escapeHtml(addr.line2 || '')}"></div>
          <div class="field-row">
            <div class="field"><label>City</label><input type="text" id="a-city" value="${ShopEase.escapeHtml(addr.city || '')}" required></div>
            <div class="field"><label>State</label><input type="text" id="a-state" value="${ShopEase.escapeHtml(addr.state || '')}" required></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Pincode</label><input type="text" id="a-pincode" value="${ShopEase.escapeHtml(addr.pincode || '')}" required></div>
            <div class="field"><label>Country</label><input type="text" id="a-country" value="${ShopEase.escapeHtml(addr.country || 'India')}" required></div>
          </div>
          <button class="btn btn-primary" type="submit">${addr.line1 ? 'Update Address' : 'Add Address'}</button>
        </form>
      </div>

      <div class="panel" style="margin-bottom:18px;">
        <h3 style="margin-top:0;">Change Password</h3>
        <div class="form-error" id="password-error"></div>
        <div id="password-success" style="display:none; background:#dcfce7; color:#166534; padding:10px; border-radius:8px; font-size:13.5px; margin-bottom:14px;"></div>
        <form id="password-form">
          <div class="field-row">
            <div class="field"><label>Current Password</label><input type="password" id="cur-pass" required></div>
            <div class="field"><label>New Password</label><input type="password" id="new-pass" minlength="8" required></div>
          </div>
          <button class="btn btn-outline" type="submit">Change Password</button>
        </form>
      </div>

      <div class="panel" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${ShopEase.escapeHtml(u.name)}</strong><br>
          <span style="color:var(--gray-500); font-size:13px;">Member since ${new Date(u.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
        <button class="btn btn-danger" id="logout-btn">Log Out</button>
      </div>`;

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('profile-error');
      errEl.classList.remove('show');
      try {
        await api('/api/profile', { method: 'PUT', body: { name: document.getElementById('p-name').value.trim(), email: document.getElementById('p-email').value.trim(), mobile: document.getElementById('p-mobile').value.trim() } });
        ShopEase.toast('Profile updated', 'success');
      } catch (err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    });

    document.getElementById('address-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('address-error');
      errEl.classList.remove('show');
      try {
        await api('/api/profile/address', { method: 'PUT', body: {
          line1: document.getElementById('a-line1').value.trim(),
          line2: document.getElementById('a-line2').value.trim(),
          city: document.getElementById('a-city').value.trim(),
          state: document.getElementById('a-state').value.trim(),
          pincode: document.getElementById('a-pincode').value.trim(),
          country: document.getElementById('a-country').value.trim(),
        }});
        ShopEase.toast('Address saved', 'success');
        if (wantsAddAddress) setTimeout(() => { location.href = '/checkout.html'; }, 700);
      } catch (err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('password-error');
      errEl.classList.remove('show');
      try {
        await api('/api/profile/password', { method: 'PUT', body: { currentPassword: document.getElementById('cur-pass').value, newPassword: document.getElementById('new-pass').value } });
        document.getElementById('password-success').style.display = 'block';
        document.getElementById('password-success').textContent = 'Password changed successfully.';
        document.getElementById('password-form').reset();
      } catch (err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/index.html';
    });

    if (wantsAddAddress) document.getElementById('address-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  try {
    const data = await api('/api/profile');
    render(data.user);
  } catch (err) {
    container.innerHTML = `<p style="color:var(--red-600)">${ShopEase.escapeHtml(err.message)}</p>`;
  }
})();
