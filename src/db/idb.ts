/**
 * Minimal promise wrapper over IndexedDB.
 *
 * Deliberately dependency-free and deliberately the *only* place that knows
 * about storage. Swapping in an encrypted or server-backed store later means
 * reimplementing this file and `repository.ts`, nothing else.
 */

export const DB_NAME = 'clerkmate'
export const DB_VERSION = 1
export const STORE_CASES = 'cases'
export const STORE_BLOBS = 'blobs'
export const STORE_META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt này không hỗ trợ IndexedDB.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        const store = db.createObjectStore(STORE_CASES, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS)
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close()
      resolve(req.result)
    }
    req.onerror = () => reject(req.error ?? new Error('Không mở được IndexedDB.'))
  })
  return dbPromise
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = run(t.objectStore(store))
    let result: T
    req.onsuccess = () => {
      result = req.result
    }
    req.onerror = () => reject(req.error)
    t.oncomplete = () => resolve(result)
    t.onabort = () => reject(t.error)
    t.onerror = () => reject(t.error)
  })
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>),
  put: <T>(store: string, value: T, key?: IDBValidKey) =>
    tx<IDBValidKey>(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
  del: (store: string, key: IDBValidKey) =>
    tx<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>),
  all: <T>(store: string) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  keys: (store: string) => tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
  clear: (store: string) => tx<undefined>(store, 'readwrite', (s) => s.clear() as IDBRequest<undefined>),
  raw: wrap,
}
