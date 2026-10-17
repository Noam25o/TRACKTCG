import { FORMAT, decodeStored, encodeBackup } from './collection.mjs';

export function createBrowserStore(factory = globalThis.indexedDB, name = 'tracktcg.web.v1') {
  let connection;
  function open() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!factory) { reject(new Error('Stockage indisponible. Les ajouts sont bloqués pour ne pas perdre ta collection.')); return; }
      const request = factory.open(name, 1); let failed = false;
      const fail = () => { failed = true; reject(new Error('Stockage indisponible ou bloqué. Ferme les autres onglets du site et réessaie après rechargement.')); };
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state'); };
      request.onerror = fail; request.onblocked = fail;
      request.onsuccess = () => {
        if (failed) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close(); resolve(request.result);
      };
    });
    return connection;
  }
  async function transact(mutator) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let result, problem;
      const transaction = db.transaction('state', mutator ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('state'), request = store.get('collection');
      // Update synchronously inside onsuccess: read+write in ONE transaction,
      // including across tabs. Commit, not put success, acknowledges persistence.
      request.onsuccess = () => {
        try {
          const entries = decodeStored(request.result);
          result = mutator ? mutator(entries) : entries;
          if (mutator) {
            const backup = JSON.parse(encodeBackup(result));
            store.put({ format: FORMAT, version: 1, entries: backup.entries }, 'collection');
          }
        } catch (error) { problem = error; transaction.abort(); }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () => reject(problem || new Error('Sauvegarde impossible. Les données précédentes sont conservées ; vérifie le stockage du navigateur.'));
    });
  }
  return { load: () => transact(), update: (mutator) => transact(mutator),
    async close() { if (connection) { const db = await connection; db.close(); connection = null; } } };
}
