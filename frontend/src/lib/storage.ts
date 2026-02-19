import { openDB, type IDBPDatabase } from "idb";
import type { Lecture } from "./types";

const DB_NAME = "lecture-notes-db";
const DB_VERSION = 1;
const STORE_LECTURES = "lectures";
const STORE_AUDIO = "audio";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_LECTURES)) {
          const store = db.createObjectStore(STORE_LECTURES, { keyPath: "id" });
          store.createIndex("course", "course");
          store.createIndex("date", "date");
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveLectureLocal(lecture: Lecture, audioBlob?: Blob): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_LECTURES, STORE_AUDIO], "readwrite");
  await tx.objectStore(STORE_LECTURES).put(lecture);
  if (audioBlob) {
    await tx.objectStore(STORE_AUDIO).put(audioBlob, lecture.id);
  }
  await tx.done;
}

export async function getLectureLocal(id: string): Promise<(Lecture & { audioBlob?: Blob }) | undefined> {
  const db = await getDB();
  const meta: Lecture | undefined = await db.get(STORE_LECTURES, id);
  if (!meta) return undefined;
  const audioBlob: Blob | undefined = await db.get(STORE_AUDIO, id);
  return { ...meta, audioBlob };
}

export async function getAllLecturesLocal(): Promise<Lecture[]> {
  const db = await getDB();
  const metas: Lecture[] = await db.getAll(STORE_LECTURES);
  return metas.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function deleteLectureLocal(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_LECTURES, STORE_AUDIO], "readwrite");
  await tx.objectStore(STORE_LECTURES).delete(id);
  await tx.objectStore(STORE_AUDIO).delete(id);
  await tx.done;
}

export async function updateLectureLocal(id: string, updates: Partial<Lecture>): Promise<void> {
  const db = await getDB();
  const existing: Lecture | undefined = await db.get(STORE_LECTURES, id);
  if (!existing) return;
  const merged = { ...existing, ...updates };
  await db.put(STORE_LECTURES, merged);
}
