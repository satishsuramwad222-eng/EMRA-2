// Product image uploads.
// Locally: files go to public/uploads (multer disk storage, unchanged).
// On Netlify: the disk is read-only, so images are kept in Netlify Blobs and
// served back through GET /uploads/:name. The saved URL format
// (/uploads/<file>) is identical in both modes.
const path = require('path');
const crypto = require('crypto');
const { IS_NETLIFY } = require('../db/store');

// Netlify Functions accept request bodies up to ~6MB (base64 overhead included).
const MAX_UPLOAD_BYTES = IS_NETLIFY ? 4 * 1024 * 1024 : 5 * 1024 * 1024;

const TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'emra-uploads', consistency: 'strong' });
}

// Runs after multer: stores req.file.buffer in Blobs and sets req.file.filename.
async function persistUpload(req, res, next) {
  if (!IS_NETLIFY || !req.file) return next();
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${crypto.randomBytes(12).toString('hex')}${ext}`;
    await getBlobStore().set(filename, req.file.buffer, {
      metadata: { contentType: TYPES[ext] || req.file.mimetype },
    });
    req.file.filename = filename;
    next();
  } catch (err) {
    next(err);
  }
}

// GET /uploads/:name -- only reached on Netlify for files that are not part of
// the deployed static site (i.e. images uploaded after deploy).
async function serveUpload(req, res, next) {
  const name = req.params.name;
  if (!IS_NETLIFY || !/^[a-f0-9]{24}\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return next();
  try {
    const data = await getBlobStore().get(name, { type: 'arrayBuffer' });
    if (!data) return res.status(404).end();
    res.setHeader('Content-Type', TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(data));
  } catch (err) {
    next(err);
  }
}

module.exports = { persistUpload, serveUpload, IS_NETLIFY, MAX_UPLOAD_BYTES };
