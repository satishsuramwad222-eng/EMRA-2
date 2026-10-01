// Thin wrapper around fetch(). The server sets an httpOnly session cookie on
// login/register, so we just need `credentials: 'include'` on every request
// for auth to work -- no token handling needed in the browser.
async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData - browser sets multipart headers itself
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    throw new ApiError('Something went wrong. Please check your connection and try again.', 0, null);
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    throw new ApiError((data && (data.message || data.error)) || 'Something went wrong. Please try again.', res.status, data);
  }
  return data;
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
