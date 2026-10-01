// ============================================================================
// Minimal file-based data store.
//
// Every "collection" is a JSON array persisted to data/<name>.json. All reads
// and writes below happen with synchronous fs calls and no `await` in
// between, so each operation runs to completion within a single tick of
// Node's event loop -- there is no window for two requests to interleave and
// corrupt a read-modify-write. That gives us safe-enough concurrency for a
// small shop without needing a real database server.
//
// To move to Postgres/MySQL/Mongo later, you only need to reimplement the
// methods below (readAll/writeAll/insert/update/remove/findById) -- nothing
// in routes/ talks to the filesystem directly, so the rest of the app is
// unaffected.
// ============================================================================
const fs = require('fs');
const path = require('path');

// Netlify (AWS Lambda) has a read-only filesystem and no shared memory between
// requests, so there the same JSON "collections" are kept in Netlify Blobs.
// Each request loads them into memory, the routes use the exact same
// synchronous API as before, and changed collections are saved just before the
// response is sent. Locally nothing changes: it still uses data/*.json.
const IS_NETLIFY = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const COLLECTIONS = [
  'admins', 'carts', 'counters', 'order_idempotency_keys', 'orders',
  'password_resets', 'products', 'returns', 'users', 'wishlists',
];

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!IS_NETLIFY && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

// ---- Netlify mode: in-memory cache (raw JSON strings) + dirty tracking ----
const cache = {};
const dirty = new Set();

function parse(name, raw) {
  if (!raw || !raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[store] Failed to parse ${name}.json:`, err.message);
    return [];
  }
}

function readAll(name) {
  if (IS_NETLIFY) return parse(name, cache[name]);
  const p = filePath(name);
  if (!fs.existsSync(p)) return [];
  return parse(name, fs.readFileSync(p, 'utf8'));
}

function writeAll(name, records) {
  const json = JSON.stringify(records, null, 2);
  if (IS_NETLIFY) {
    cache[name] = json;
    dirty.add(name);
    return;
  }
  fs.writeFileSync(filePath(name), json, 'utf8');
}

function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'emra-data', consistency: 'strong' });
}

async function hydrate() {
  if (!IS_NETLIFY) return;
  dirty.clear();
  const blobs = getBlobStore();
  await Promise.all(
    COLLECTIONS.map(async (name) => {
      let raw = await blobs.get(name);
      if (raw == null) {
        // First run: start from the data files that ship with the project.
        const p = filePath(name);
        raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '[]';
      }
      cache[name] = raw;
    })
  );
}

async function flush() {
  if (!IS_NETLIFY || dirty.size === 0) return;
  const blobs = getBlobStore();
  const names = [...dirty];
  dirty.clear();
  await Promise.all(names.map((name) => blobs.set(name, cache[name])));
}

// Express middleware: load data before the route runs, save it before the
// response is actually sent to the browser.
function middleware(req, res, next) {
  if (!IS_NETLIFY) return next();
  hydrate()
    .then(() => {
      const originalEnd = res.end;
      let ended = false;
      res.end = function (...args) {
        if (ended) return originalEnd.apply(res, args);
        ended = true;
        flush()
          .catch((err) => console.error('[store] Failed to save data:', err))
          .then(() => originalEnd.apply(res, args));
        return res;
      };
      next();
    })
    .catch((err) => {
      console.error('[store] Failed to load data:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    });
}

function collection(name) {
  return {
    readAll: () => readAll(name),
    writeAll: (records) => writeAll(name, records),

    findById: (id) => readAll(name).find((r) => r.id === id) || null,

    find: (predicate) => readAll(name).filter(predicate),

    findOne: (predicate) => readAll(name).find(predicate) || null,

    insert: (record) => {
      const records = readAll(name);
      records.push(record);
      writeAll(name, records);
      return record;
    },

    update: (id, patch) => {
      const records = readAll(name);
      const idx = records.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      records[idx] = { ...records[idx], ...patch };
      writeAll(name, records);
      return records[idx];
    },

    // Run a custom mutation function against the whole array and persist the
    // result. Used for operations that must read-and-write atomically, such
    // as decrementing stock.
    mutate: (fn) => {
      const records = readAll(name);
      const result = fn(records);
      writeAll(name, records);
      return result;
    },

    remove: (id) => {
      const records = readAll(name);
      const next = records.filter((r) => r.id !== id);
      writeAll(name, next);
      return next.length !== records.length;
    },
  };
}

module.exports = { collection, middleware, IS_NETLIFY };
