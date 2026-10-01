// ============================================================================
// Google Sheets sync.
//
// Posts JSON to the Apps Script web app URL configured in config.googleSheets
// .webAppUrl (see google-apps-script/Code.gs and README.md for exact setup
// steps). If no URL is configured, sync is skipped and callers are told so
// explicitly -- we never silently pretend an order synced when it didn't
// (spec section 27: don't hide sync failures behind a fake success message).
// ============================================================================
const config = require('../config/config');

async function postToSheet(sheetTab, payload) {
  const { webAppUrl, sharedSecret } = config.googleSheets;
  if (!webAppUrl) {
    return { skipped: true, reason: 'GOOGLE_SHEETS_WEBAPP_URL is not configured' };
  }
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: sharedSecret, sheet: sheetTab, data: payload }),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok || json.status === 'error') {
      return { skipped: false, ok: false, error: json.message || `HTTP ${res.status}` };
    }
    return { skipped: false, ok: true };
  } catch (err) {
    return { skipped: false, ok: false, error: err.message };
  }
}

// One row per product in the order, so multi-product orders don't lose
// per-product detail in the sheet (spec section 15).
function syncOrderToSheet(order, user) {
  const rows = order.items.map((item) => ({
    orderId: order.id,
    orderDate: order.createdAt,
    customerName: user.name,
    mobileNumber: user.mobile,
    emailId: user.email,
    address: formatAddress(order.address),
    productId: item.productId,
    productName: item.name,
    productImage: item.image,
    category: item.category || '',
    quantity: item.quantity,
    productPrice: item.price,
    gstPercent: item.gstPercent,
    cgst: item.cgst,
    sgst: item.sgst,
    totalProductAmount: item.lineTotal,
    totalOrderAmount: order.total,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    trackingId: order.trackingId,
  }));
  return postToSheet('Orders', rows);
}

function syncReturnToSheet(ret) {
  return postToSheet('Return Requests', [
    {
      returnId: ret.id,
      orderId: ret.orderId,
      productId: ret.productId,
      productName: ret.productName,
      customerName: ret.customerName,
      mobileNumber: ret.mobile,
      email: ret.email,
      address: ret.address,
      reason: ret.reason,
      comments: ret.comments || '',
      requestDate: ret.createdAt,
      productImage: ret.productImage,
      orderAmount: ret.orderAmount,
      status: ret.status,
    },
  ]);
}

function formatAddress(addr) {
  if (!addr) return '';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country]
    .filter(Boolean)
    .join(', ');
}

module.exports = { syncOrderToSheet, syncReturnToSheet, formatAddress };
