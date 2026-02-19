import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "lecture-notes-db";
const DB_VERSION = 2;
const STORE_AUDIO = "audio";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveAudioBlob(lectureId: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put(STORE_AUDIO, blob, lectureId);
}

export async function getAudioBlob(lectureId: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get(STORE_AUDIO, lectureId);
}

export async function deleteAudioBlob(lectureId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_AUDIO, lectureId);
}
