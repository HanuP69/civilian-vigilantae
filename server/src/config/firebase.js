import config from './env.js';

// ---------------------------------------------------------------------------
// In-memory mock Firestore
// ---------------------------------------------------------------------------
// Stores data as:  Map<collectionName, Map<docId, documentData>>
// Implements the subset of the Firestore Admin API the app actually uses.
// ---------------------------------------------------------------------------

/**
 * Create an in-memory Firestore mock for local development without credentials.
 *
 * Supports:
 *   collection(name).doc(id).set(data)
 *   collection(name).doc(id).get()
 *   collection(name).doc(id).update(data)
 *   collection(name).doc(id).delete()
 *   collection(name).get()
 *   collection(name).where(field, op, value).get()
 *
 * @returns {object} A mock Firestore instance.
 */
export function createMockFirestore() {
  /** @type {Map<string, Map<string, object>>} */
  const store = new Map();

  /**
   * Guarantee a collection map exists and return it.
   * @param {string} name
   * @returns {Map<string, object>}
   */
  const ensureCollection = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
  };

  /**
   * Build a document-snapshot-like object.
   * @param {string} id
   * @param {object|undefined} data
   */
  const snap = (id, data) => ({
    id,
    exists: data !== undefined,
    data: () => (data ? { ...data } : undefined),
  });

  /**
   * Evaluate a simple where clause against a document.
   * @param {object} data
   * @param {string} field
   * @param {string} op
   * @param {*} value
   * @returns {boolean}
   */
  const evaluate = (data, field, op, value) => {
    const fieldValue = data[field];
    switch (op) {
      case '==':  return fieldValue === value;
      case '!=':  return fieldValue !== value;
      case '<':   return fieldValue < value;
      case '<=':  return fieldValue <= value;
      case '>':   return fieldValue > value;
      case '>=':  return fieldValue >= value;
      case 'in':  return Array.isArray(value) && value.includes(fieldValue);
      case 'array-contains':
        return Array.isArray(fieldValue) && fieldValue.includes(value);
      default:
        console.warn(`[MockFirestore] Unsupported operator: ${op}`);
        return false;
    }
  };

  /**
   * Build a query-snapshot-like object from matching documents.
   * @param {Array<{id: string, data: object}>} docs
   */
  const querySnap = (docs) => ({
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((d) => snap(d.id, d.data)),
    forEach: (cb) => docs.forEach((d) => cb(snap(d.id, d.data))),
  });

  /**
   * Create a document reference.
   * @param {string} collectionName
   * @param {string} docId
   */
  const docRef = (collectionName, docId) => ({
    id: docId,

    /** @param {object} data */
    set: async (data) => {
      ensureCollection(collectionName).set(docId, { ...data });
    },

    get: async () => {
      const col = ensureCollection(collectionName);
      return snap(docId, col.get(docId));
    },

    /** @param {object} data */
    update: async (data) => {
      const col = ensureCollection(collectionName);
      const existing = col.get(docId);
      if (!existing) throw new Error(`Document ${collectionName}/${docId} not found`);
      col.set(docId, { ...existing, ...data });
    },

    delete: async () => {
      ensureCollection(collectionName).delete(docId);
    },
  });

  /**
   * Create a collection reference.
   * @param {string} name
   */
  const collectionRef = (name) => ({
    /** @param {string} [id] */
    doc: (id) => {
      const resolvedId = id || crypto.randomUUID();
      return docRef(name, resolvedId);
    },

    get: async () => {
      const col = ensureCollection(name);
      const docs = [];
      for (const [id, data] of col.entries()) {
        docs.push({ id, data: { ...data } });
      }
      return querySnap(docs);
    },

    /**
     * @param {string} field
     * @param {string} op
     * @param {*} value
     */
    where: (field, op, value) => {
      /** @type {Array<{field: string, op: string, value: *}>} */
      const filters = [{ field, op, value }];

      const query = {
        /**
         * Chain additional where clauses.
         * @param {string} f
         * @param {string} o
         * @param {*} v
         */
        where: (f, o, v) => {
          filters.push({ field: f, op: o, value: v });
          return query;
        },

        get: async () => {
          const col = ensureCollection(name);
          const docs = [];
          for (const [id, data] of col.entries()) {
            const matches = filters.every((flt) =>
              evaluate(data, flt.field, flt.op, flt.value),
            );
            if (matches) docs.push({ id, data: { ...data } });
          }
          return querySnap(docs);
        },
      };

      return query;
    },
  });

  return { collection: collectionRef };
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/** @type {object} */
let db;
/** @type {object|null} */
let auth = null;
/** @type {object|null} */
let storage = null;

export function setDb(nextDb) {
  db = nextDb;
}

const isTestEnv = 
  process.env.NODE_ENV === 'test' || 
  process.execArgv.includes('--test') || 
  process.argv.some(arg => arg.includes('.test.js') || arg.includes('__tests__'));

if (config.firebaseProjectId && !isTestEnv) {
  // Real Firebase Admin SDK — lazy-imported so devs without credentials
  // never hit a missing-module error.
  try {
    const admin = await import('firebase-admin');

    const app = admin.default.initializeApp({
      credential: admin.default.credential.cert({
        projectId:   config.firebaseProjectId,
        clientEmail: config.firebaseClientEmail,
        privateKey:  config.firebasePrivateKey,
      }),
      storageBucket: config.firebaseStorageBucket,
    });

    db      = admin.default.firestore();
    auth    = admin.default.auth();
    storage = admin.default.storage().bucket();

    console.log('[Firebase] Initialised with project:', config.firebaseProjectId);
  } catch (err) {
    console.error('[Firebase] Failed to initialise, falling back to mock:', err.message);
    db = createMockFirestore();
  }
} else {
  if (isTestEnv) {
    console.log('[Firebase] Test environment detected — using in-memory mock Firestore for tests');
  } else {
    console.log('[Firebase] No credentials found — using in-memory mock Firestore');
  }
  db = createMockFirestore();
}

export { db, auth, storage };
