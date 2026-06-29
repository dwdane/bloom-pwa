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

  async function deleteEntry(id) {
    const db = await open();
    const tx = db.transaction(ENTRIES, 'readwrite');
    tx.objectStore(ENTRIES).delete(id);
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

  // Entries belonging to a given day (ISO 'YYYY-MM-DD'). Matches an explicit
  // entry.date, or falls back to the creation day for older entries.
  async function entriesForDate(dateIso) {
    const all = await allEntries();
    return all.filter((e) => {
      const d = e.date || (e.createdAt ? new Date(e.createdAt) : null);
      if (!d) return false;
      if (typeof d === 'string') return d === dateIso;
      const p = (n) => String(n).padStart(2, '0');
      const iso = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      return iso === dateIso;
    });
  }

  // Entries of one kind, sorted oldest-first by creation time (for charts).
  // Sort key: the day an entry represents (back-dated entries sort correctly),
  // breaking ties by when it was logged.
  function sortKey(e) {
    const dayMs = e.date ? Date.parse(e.date) : (e.createdAt || 0);
    return dayMs * 1e7 + (e.createdAt || 0) % 1e7;
  }

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
          out.sort((a, b) => sortKey(a) - sortKey(b));
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
    deleteEntry,
    entriesForWeek,
    entriesForDate,
    allEntries,
    entriesOfKind,
  };
})();
