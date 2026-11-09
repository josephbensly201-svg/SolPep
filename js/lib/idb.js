/* Mini-enveloppe IndexedDB, compatible avec l'API de la bibliothèque `idb` (Jake Archibald).
 *
 * Elle implémente uniquement le sous-ensemble utilisé par SòlPèp :
 *   openDB(name, version, { upgrade })
 *   db.get / getAll / getAllFromIndex / put / delete / clear
 *   db.transaction(stores, mode) -> tx.objectStore(name).put/delete/get/getAll, tx.done
 *
 * Pour utiliser la vraie bibliothèque `idb`, remplacez simplement ce fichier par
 * https://cdn.jsdelivr.net/npm/idb@8/build/index.js (même nom : js/lib/idb.js).
 * Aucune autre ligne du projet n'a besoin de changer.
 */

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class Store {
  constructor(store) { this.store = store; }
  get(key) { return wrap(this.store.get(key)); }
  getAll(query) { return wrap(this.store.getAll(query)); }
  getAllFromIndex(index, query) { return wrap(this.store.index(index).getAll(query)); }
  put(value, key) { return wrap(this.store.put(value, key)); }
  delete(key) { return wrap(this.store.delete(key)); }
  clear() { return wrap(this.store.clear()); }
}

class Tx {
  constructor(tx) {
    this.tx = tx;
    this.done = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
    });
    this.done.catch(() => {});
  }
  objectStore(name) { return new Store(this.tx.objectStore(name)); }
}

class DB {
  constructor(db) { this.db = db; }
  get objectStoreNames() { return this.db.objectStoreNames; }
  transaction(stores, mode = 'readonly') { return new Tx(this.db.transaction(stores, mode)); }
  close() { this.db.close(); }
  get(store, key) { return this.transaction(store).objectStore(store).get(key); }
  getAll(store, query) { return this.transaction(store).objectStore(store).getAll(query); }
  getAllFromIndex(store, index, query) { return this.transaction(store).objectStore(store).getAllFromIndex(index, query); }
  async put(store, value, key) {
    const tx = this.transaction(store, 'readwrite');
    const result = await tx.objectStore(store).put(value, key);
    await tx.done;
    return result;
  }
  async delete(store, key) {
    const tx = this.transaction(store, 'readwrite');
    await tx.objectStore(store).delete(key);
    await tx.done;
  }
  async clear(store) {
    const tx = this.transaction(store, 'readwrite');
    await tx.objectStore(store).clear();
    await tx.done;
  }
}

export function openDB(name, version, { upgrade, blocked } = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      if (upgrade) upgrade(request.result, event.oldVersion, event.newVersion, request.transaction);
    };
    request.onblocked = () => blocked && blocked();
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(new DB(db));
    };
    request.onerror = () => reject(request.error);
  });
}
