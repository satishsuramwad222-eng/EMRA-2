const express = require('express');
const PDFDocument = require('pdfkit');
const { collection } = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const config = require('../config/config');
const { formatAddress } = require('../services/googleSheets');

const router = express.Router();
const orders = collection('orders');
const users = collection('users');

function money(n) {
  return `Rs. ${Number(n).toFixed(2)}`;
}

router.get('/:orderId', requireAuth, (req, res) => {
  const order = orders.findById(req.params.orderId);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  const user = users.findById(req.user.id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.id}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  // ---- Header: company info ----
  doc.fontSize(20).fillColor('#1e3a8a').text(config.company.name, { continued: false });
  doc.fontSize(9).fillColor('#444')
    .text(config.company.address)
    .text(`Customer care: ${config.company.customerCareNumber}  |  Email: ${config.company.email}`)
    .text(`GSTIN: ${config.company.gstNumber}`);
  doc.moveDown(1);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(16).fillColor('#111').text('TAX INVOICE', { align: 'right' });
  doc.moveDown(0.5);

  // ---- Customer & order info ----
  const infoTop = doc.y;
  doc.fontSize(10).fillColor('#111');
  doc.text('Billed To:', 50, infoTop, { continued: false }).font('Helvetica-Bold')
    .text(user.name, 50).font('Helvetica')
    .text(user.mobile, 50)
    .text(user.email, 50)
    .text(formatAddress(order.address), 50, doc.y, { width: 250 });

  doc.fontSize(10);
  doc.text(`Order ID: ${order.id}`, 320, infoTop, { width: 225, align: 'right' });
  doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString('en-IN')}`, 320, doc.y, { width: 225, align: 'right' });
  doc.text(`Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})`, 320, doc.y, { width: 225, align: 'right' });
  doc.text(`Tracking ID: ${order.trackingId}`, 320, doc.y, { width: 225, align: 'right' });

  doc.moveDown(2);

  // ---- Line items table ----
  const tableTop = doc.y;
  const cols = { name: 50, qty: 260, price: 310, cgst: 375, sgst: 440, total: 495 };
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
  doc.rect(50, tableTop, 495, 20).fill('#1e3a8a');
  doc.fillColor('#fff')
    .text('Product', cols.name + 5, tableTop + 6)
    .text('Qty', cols.qty, tableTop + 6)
    .text('Price', cols.price, tableTop + 6)
    .text('CGST', cols.cgst, tableTop + 6)
    .text('SGST', cols.sgst, tableTop + 6)
    .text('Total', cols.total, tableTop + 6);

  let y = tableTop + 24;
  doc.font('Helvetica').fontSize(9).fillColor('#111');
  order.items.forEach((item, idx) => {
    if (idx % 2 === 1) doc.rect(50, y - 4, 495, 20).fill('#f3f4f6').fillColor('#111');
    doc.text(item.name, cols.name + 5, y, { width: 200 });
    doc.text(String(item.quantity), cols.qty, y);
    doc.text(money(item.price), cols.price, y);
    doc.text(money(item.cgst), cols.cgst, y);
    doc.text(money(item.sgst), cols.sgst, y);
    doc.text(money(item.lineTotal), cols.total, y);
    y += 22;
  });

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  y += 10;

  doc.font('Helvetica').fontSize(10);
  doc.text(`Subtotal: ${money(order.subtotal)}`, 350, y, { width: 195, align: 'right' }); y += 16;
  doc.text(`CGST: ${money(order.cgst)}`, 350, y, { width: 195, align: 'right' }); y += 16;
  doc.text(`SGST: ${money(order.sgst)}`, 350, y, { width: 195, align: 'right' }); y += 16;
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(`Total: ${money(order.total)}`, 350, y, { width: 195, align: 'right' });

  doc.moveDown(4);
  doc.font('Helvetica').fontSize(8).fillColor('#888')
    .text('This is a computer-generated invoice and does not require a signature.', 50, doc.y, { align: 'center', width: 495 });

  doc.end();
});

module.exports = router;
