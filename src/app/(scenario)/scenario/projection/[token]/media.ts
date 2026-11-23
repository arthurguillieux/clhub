/**
 * The evening's media live on the projection computer only (Arthur's choice): its operator picks the
 * folder once, the files are kept in this browser (IndexedDB), and nothing ever goes to the CLHUB.
 * Files are found by their name, case and format aside: `vent.aac` stands for `vent.mp3`, `log-1.webm`
 * for `log-1.mp4`, `accueil.png` for `accueil.jpg`. Subtitles (.vtt) keep their own extension.
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

/** The formats a browser plays: sounds, videos, images. */
export const MEDIA_FORMATS = /\.(mp3|aac|m4a|ogg|oga|opus|wav|flac|mp4|m4v|webm|mov|jpe?g|png|webp|gif)$/i;

export const keyOf = (name: string) => name.trim().toLowerCase().replace(MEDIA_FORMATS, "");

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
      // Files kept before formats were set aside were stored under their full name: same key now.
      out.set(keyOf(String(c.key)), c.value as Blob);
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
