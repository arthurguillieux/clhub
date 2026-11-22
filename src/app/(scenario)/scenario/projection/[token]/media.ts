/**
 * The evening's media live on the projection computer only (Arthur's choice): its operator picks the
 * folder once, the files are kept in this browser (IndexedDB), and nothing ever goes to the CLHUB.
 * Files are found by their name, case aside.
 */
const DB_NAME = "clhub-scenario-media";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const keyOf = (name: string) => name.trim().toLowerCase();

/** Keeps the chosen files (only the ones the scenario asks for, so a whole folder of holiday photos stays out). */
export async function keepFiles(files: File[], wanted: Set<string>): Promise<number> {
  const db = await open();
  const kept = files.filter((f) => wanted.has(keyOf(f.name)));
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const f of kept) tx.objectStore(STORE).put(f, keyOf(f.name));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return kept.length;
}

export async function loadFiles(): Promise<Map<string, Blob>> {
  const db = await open();
  const out = new Map<string, Blob>();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const cursor = tx.objectStore(STORE).openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return resolve();
      out.set(String(c.key), c.value as Blob);
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
  db.close();
  return out;
}

export async function forgetFiles(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
  });
  db.close();
}
