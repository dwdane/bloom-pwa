// db.js
// IndexedDB layer for Bloom PWA. Plain (unencrypted) storage for now — the data
// already lives in the browser's per-app sandbox. A Web Crypto layer can be
// added later without changing the calling code much.
//
// Stores:
//   settings      — small key/value records (dates, units, preferences, mode)
//   entries       — pregnancy health log entries (feelings, weight, bump)
//   events        — baby care events (nursing, bottles, pumping, sleep, diapers)
//   measurements  — baby growth measurements (weight, length, head)

const Store = (() => {
  const DB_NAME = 'bloom';
  const VERSION = 2;
  const SETTINGS = 'settings';
  const ENTRIES = 'entries';
  const EVENTS = 'events';
  const MEASUREMENTS = 'measurements';

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
        if (!db.objectStoreNames.contains(EVENTS)) {
          const events = db.createObjectStore(EVENTS, { keyPath: 'id' });
          events.createIndex('byStart', 'start', { unique: false });
        }
        if (!db.objectStoreNames.contains(MEASUREMENTS)) {
          const m = db.createObjectStore(MEASUREMENTS, { keyPath: 'id' });
          m.createIndex('byDate', 'date', { unique: false });
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

  function getAllFrom(objectStore, query) {
    return new Promise((resolve, reject) => {
      const req = query ? objectStore.getAll(query) : objectStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
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

  // --- entries (pregnancy daily log) ---

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
    return getAllFrom(s);
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

  // Entries of one kind, sorted oldest-first (for charts). Sort key: the day an
  // entry represents (back-dated entries sort correctly), tie-broken by log time.
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

  // --- events (baby care) ---
  // Shape: { id, childId, type: 'nurse'|'bottle'|'pump'|'sleep'|'diaper',
  //          start, end|null, side|null, amountMl|null, kind|null, notes|null }

  async function putEvent(ev) {
    const db = await open();
    const tx = db.transaction(EVENTS, 'readwrite');
    tx.objectStore(EVENTS).put(ev);
    return done(tx);
  }

  async function deleteEvent(id) {
    const db = await open();
    const tx = db.transaction(EVENTS, 'readwrite');
    tx.objectStore(EVENTS).delete(id);
    return done(tx);
  }

  // Events whose start falls in [fromMs, toMs], sorted by start ascending.
  // Callers widen the lower bound to catch events that span into the window.
  async function eventsInRange(fromMs, toMs) {
    const s = await store(EVENTS, 'readonly');
    const rows = await getAllFrom(s.index('byStart'), IDBKeyRange.bound(fromMs, toMs));
    rows.sort((a, b) => a.start - b.start);
    return rows;
  }

  // --- measurements (baby growth) ---
  // Shape: { id, date: 'YYYY-MM-DD', weightG|null, lengthCm|null, headCm|null }

  async function putMeasurement(m) {
    const db = await open();
    const tx = db.transaction(MEASUREMENTS, 'readwrite');
    tx.objectStore(MEASUREMENTS).put(m);
    return done(tx);
  }

  async function deleteMeasurement(id) {
    const db = await open();
    const tx = db.transaction(MEASUREMENTS, 'readwrite');
    tx.objectStore(MEASUREMENTS).delete(id);
    return done(tx);
  }

  async function allMeasurements() {
    const s = await store(MEASUREMENTS, 'readonly');
    const rows = await getAllFrom(s);
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return rows;
  }

  // --- backup (all stores, dynamically enumerated) ---

  async function exportAll() {
    const db = await open();
    const names = [...db.objectStoreNames];
    const out = {};
    for (const name of names) {
      const s = db.transaction(name, 'readonly').objectStore(name);
      out[name] = await getAllFrom(s);
    }
    return out;
  }

  // Destructive restore: clears each store present in the payload, then loads
  // its rows. Stores unknown to this app version are skipped.
  async function importAll(data) {
    const db = await open();
    for (const name of Object.keys(data)) {
      if (!db.objectStoreNames.contains(name)) continue;
      if (!Array.isArray(data[name])) continue;
      const tx = db.transaction(name, 'readwrite');
      const s = tx.objectStore(name);
      s.clear();
      for (const row of data[name]) s.put(row);
      await done(tx);
    }
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
    putEvent,
    deleteEvent,
    eventsInRange,
    putMeasurement,
    deleteMeasurement,
    allMeasurements,
    exportAll,
    importAll,
  };
})();
