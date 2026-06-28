// db.js
// IndexedDB layer for Bloom PWA. Plain (unencrypted) storage for now — the data
// already lives in the browser's per-app sandbox. A Web Crypto layer can be
// added later without changing the calling code much.
//
// Stores:
//   settings  — small key/value records (pregnancy dates, units, preferences)
//   entries   — health log entries (added in a later layer; store created now)

const Store = (() => {
  const DB_NAME = 'bloom';
  const VERSION = 1;
  const SETTINGS = 'settings';
  const ENTRIES = 'entries';

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(ENTRIES)) {
          const entries = db.createObjectStore(ENTRIES, {
            keyPath: 'id',
            autoIncrement: true,
          });
          entries.createIndex('byWeek', 'week', { unique: false });
          entries.createIndex('byKind', 'kind', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function store(name, mode) {
    return open().then((db) => db.transaction(name, mode).objectStore(name));
  }

  function done(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // --- settings (key/value) ---

  async function getSetting(key) {
    const s = await store(SETTINGS, 'readonly');
    return new Promise((resolve, reject) => {
      const req = s.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async function setSetting(key, value) {
    const db = await open();
    const tx = db.transaction(SETTINGS, 'readwrite');
    tx.objectStore(SETTINGS).put({ key, value });
    return done(tx);
  }

  // --- entries (used by the logging layer, defined now for forward use) ---

  async function addEntry(entry) {
    const db = await open();
    const tx = db.transaction(ENTRIES, 'readwrite');
    tx.objectStore(ENTRIES).add({ ...entry, createdAt: Date.now() });
    return done(tx);
  }

  async function entriesForWeek(week) {
    const s = await store(ENTRIES, 'readonly');
    return new Promise((resolve, reject) => {
      const out = [];
      const req = s.index('byWeek').openCursor(IDBKeyRange.only(week));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          out.push(cursor.value);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function allEntries() {
    const s = await store(ENTRIES, 'readonly');
    return new Promise((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Entries of one kind, sorted oldest-first by creation time (for charts).
  async function entriesOfKind(kind) {
    const s = await store(ENTRIES, 'readonly');
    return new Promise((resolve, reject) => {
      const out = [];
      const req = s.index('byKind').openCursor(IDBKeyRange.only(kind));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          out.push(cursor.value);
          cursor.continue();
        } else {
          out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  return {
    getSetting,
    setSetting,
    addEntry,
    entriesForWeek,
    allEntries,
    entriesOfKind,
  };
})();
