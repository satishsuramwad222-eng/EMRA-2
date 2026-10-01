(async function () {
  await ShopEase.init();

  function showError(msg) {
    const el = document.getElementById('form-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }
  function clearError() {
    const el = document.getElementById('form-error');
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  }

  const nextUrl = new URLSearchParams(location.search).get('next') || '/index.html';

  // ---- Login ----
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const btn = document.getElementById('submit-btn');
      btn.disabled = true; btn.textContent = 'Logging in...';
      try {
        await api('/api/auth/login', {
          method: 'POST',
          body: {
            identifier: document.getElementById('identifier').value.trim(),
            password: document.getElementById('password').value,
          },
        });
        location.href = decodeURIComponent(nextUrl);
      } catch (err) {
        showError(err.message);
        btn.disabled = false; btn.textContent = 'Log In';
      }
    });
  }

  // ---- Register ----
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const btn = document.getElementById('submit-btn');
      btn.disabled = true; btn.textContent = 'Creating account...';
      const line1 = document.getElementById('line1').value.trim();
      const address = line1 ? {
        line1,
        city: document.getElementById('city').value.trim(),
        state: document.getElementById('state').value.trim(),
        pincode: document.getElementById('pincode').value.trim(),
      } : null;
      try {
        await api('/api/auth/register', {
          method: 'POST',
          body: {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            mobile: document.getElementById('mobile').value.trim(),
            password: document.getElementById('password').value,
            address,
          },
        });
        location.href = decodeURIComponent(nextUrl);
      } catch (err) {
        showError(err.message);
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    });
  }

  // ---- Forgot password ----
  const forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const btn = document.getElementById('submit-btn');
      btn.disabled = true; btn.textContent = 'Sending...';
      try {
        const res = await api('/api/auth/forgot-password', { method: 'POST', body: { identifier: document.getElementById('identifier').value.trim() } });
        const box = document.getElementById('success-box');
        box.style.display = 'block';
        box.textContent = res.message;
        forgotForm.style.display = 'none';
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Send Reset Link';
      }
    });
  }

  // ---- Reset password ----
  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    const token = new URLSearchParams(location.search).get('token');
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      if (!token) { showError('This reset link is invalid.'); return; }
      const btn = document.getElementById('submit-btn');
      btn.disabled = true; btn.textContent = 'Updating...';
      try {
        const res = await api('/api/auth/reset-password', { method: 'POST', body: { token, password: document.getElementById('password').value } });
        const box = document.getElementById('success-box');
        box.style.display = 'block';
        box.textContent = `${res.message} Redirecting to login...`;
        resetForm.style.display = 'none';
        setTimeout(() => { location.href = '/login.html'; }, 1800);
      } catch (err) {
        showError(err.message);
        btn.disabled = false; btn.textContent = 'Update Password';
      }
    });
  }
})();
