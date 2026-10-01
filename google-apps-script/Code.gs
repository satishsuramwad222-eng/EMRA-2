/**
 * ShopEase — Google Sheets order/return sync
 * =============================================================================
 * SETUP (see README.md "Google Sheets setup" for the full walkthrough):
 *
 * 1. Create a new Google Sheet. Add two tabs named exactly:
 *      "Orders"
 *      "Return Requests"
 *    (You can also add "Products", "Users", "Settings" tabs for your own
 *    reference — this script only writes to Orders and Return Requests.)
 *
 * 2. Open Extensions > Apps Script in that Sheet, delete the placeholder
 *    code, and paste this entire file in.
 *
 * 3. In Apps Script, go to Project Settings > Script Properties and add:
 *      SHARED_SECRET = <any long random string>
 *    Use the SAME value for GOOGLE_SHEETS_SHARED_SECRET in the backend's .env.
 *
 * 4. Click Deploy > New deployment > select type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Deploy, authorize the requested permissions, and copy the Web App URL.
 *
 * 5. Paste that URL into GOOGLE_SHEETS_WEBAPP_URL in the backend's .env file.
 *
 * That's it — every successful order and return request will now append a
 * row (or rows, for multi-product orders) to the matching tab.
 * =============================================================================
 */

var ORDERS_SHEET_NAME = 'Orders';
var RETURNS_SHEET_NAME = 'Return Requests';

var ORDER_HEADERS = [
  'Order ID', 'Order Date', 'Customer Name', 'Mobile Number', 'Email ID',
  'Complete Address', 'Product ID', 'Product Name', 'Product Image', 'Category',
  'Quantity', 'Product Price', 'GST %', 'CGST', 'SGST', 'Total Product Amount',
  'Total Order Amount', 'Order Status', 'Payment Status', 'Tracking ID', 'Logged At',
];

var RETURN_HEADERS = [
  'Return ID', 'Order ID', 'Product ID', 'Product Name', 'Customer Name',
  'Mobile Number', 'Email', 'Address', 'Reason', 'Comments', 'Request Date',
  'Product Image', 'Order Amount', 'Status', 'Logged At',
];

function doPost(e) {
  var response = { status: 'ok' };
  try {
    var payload = JSON.parse(e.postData.contents);
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');

    if (expectedSecret && payload.secret !== expectedSecret) {
      return jsonResponse({ status: 'error', message: 'Invalid shared secret.' });
    }

    if (payload.sheet === ORDERS_SHEET_NAME) {
      appendOrderRows(payload.data);
    } else if (payload.sheet === RETURNS_SHEET_NAME) {
      appendReturnRows(payload.data);
    } else {
      return jsonResponse({ status: 'error', message: 'Unknown sheet tab: ' + payload.sheet });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
  return jsonResponse(response);
}

function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'ShopEase sheet sync endpoint is running.' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// `rows` is an array of order-line objects, one per product in the order, so
// a multi-product order produces multiple rows without losing per-product
// detail (matches the backend's services/googleSheets.js payload shape).
function appendOrderRows(rows) {
  var sheet = getOrCreateSheet(ORDERS_SHEET_NAME, ORDER_HEADERS);
  var now = new Date();
  rows.forEach(function (r) {
    sheet.appendRow([
      r.orderId, r.orderDate, r.customerName, r.mobileNumber, r.emailId,
      r.address, r.productId, r.productName, r.productImage, r.category,
      r.quantity, r.productPrice, r.gstPercent, r.cgst, r.sgst,
      r.totalProductAmount, r.totalOrderAmount, r.orderStatus, r.paymentStatus,
      r.trackingId, now,
    ]);
  });
}

function appendReturnRows(rows) {
  var sheet = getOrCreateSheet(RETURNS_SHEET_NAME, RETURN_HEADERS);
  var now = new Date();
  rows.forEach(function (r) {
    sheet.appendRow([
      r.returnId, r.orderId, r.productId, r.productName, r.customerName,
      r.mobileNumber, r.email, r.address, r.reason, r.comments,
      r.requestDate, r.productImage, r.orderAmount, r.status, now,
    ]);
  });
}
