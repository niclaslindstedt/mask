// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// A keyed store of binary blobs, in IndexedDB.
//
// `localStorage` holds strings and a few megabytes; a file the user picked is
// neither. IndexedDB stores a `Blob` as it is, with a quota measured in a
// share of the disk — so a vault of picked files sits here rather than beside
// the document.
//
// Every operation resolves rather than throws: a browser with IndexedDB shut
// off (a private window, a locked-down profile) or a full disk must leave the
// caller with "no blob for that id", not an unhandled rejection. A caller
// therefore treats the vault as best-effort storage, and always has something
// to fall back to when `get` comes back null.

/** The vault's operations. All are best-effort — see the note above. */
export type BlobVault = {
  /** Store `blob` under `id`, replacing whatever was there. */
  put(id: string, blob: Blob): Promise<void>;
  /** The blob stored under `id`, or null when there is none. */
  get(id: string): Promise<Blob | null>;
  /** Forget `ids`. Ids with nothing stored are already forgotten. */
  remove(ids: readonly string[]): Promise<void>;
  /** Every id the vault holds. */
  ids(): Promise<string[]>;
  /** Forget everything. */
  clear(): Promise<void>;
};

const STORE = "blobs";

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request"));
  });
}

/** Open (or create) the database `name` with a single blob store. */
export function openBlobVault(name: string): BlobVault {
  let open: Promise<IDBDatabase | null> | null = null;

  function db(): Promise<IDBDatabase | null> {
    if (open) return open;
    open = new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === "undefined") return resolve(null);
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(name, 1);
      } catch {
        return resolve(null);
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return open;
  }

  async function tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>,
    fallback: T,
  ): Promise<T> {
    const handle = await db();
    if (!handle) return fallback;
    try {
      return await run(handle.transaction(STORE, mode).objectStore(STORE));
    } catch {
      return fallback;
    }
  }

  return {
    put: (id, blob) =>
      tx(
        "readwrite",
        async (store) => {
          await promisify(store.put(blob, id));
        },
        undefined,
      ),
    get: (id) =>
      tx(
        "readonly",
        async (store) => {
          const value: unknown = await promisify(store.get(id));
          return value instanceof Blob ? value : null;
        },
        null,
      ),
    remove: (ids) =>
      tx(
        "readwrite",
        async (store) => {
          await Promise.all(ids.map((id) => promisify(store.delete(id))));
        },
        undefined,
      ),
    ids: () =>
      tx(
        "readonly",
        async (store) => {
          const keys = await promisify(store.getAllKeys());
          return keys.map(String);
        },
        [] as string[],
      ),
    clear: () =>
      tx(
        "readwrite",
        async (store) => {
          await promisify(store.clear());
        },
        undefined,
      ),
  };
}
