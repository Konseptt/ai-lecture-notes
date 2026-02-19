import { openDB, type IDBPDatabase } from "idb";
import type { Lecture } from "./types";

const DB_NAME = "lecture-notes-db";
const DB_VERSION = 1;
const STORE_LECTURES = "lectures";
const STORE_AUDIO = "audio";

interface LectureMeta extends Omit<Lecture, "audioBlob"> {}

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

export async function saveLecture(lecture: Lecture): Promise<void> {
  const db = await getDB();
  const { audioBlob, ...meta } = lecture;
  const tx = db.transaction([STORE_LECTURES, STORE_AUDIO], "readwrite");
  await tx.objectStore(STORE_LECTURES).put(meta);
  if (audioBlob) {
    await tx.objectStore(STORE_AUDIO).put(audioBlob, lecture.id);
  }
  await tx.done;
}

export async function getLecture(id: string): Promise<Lecture | undefined> {
  const db = await getDB();
  const meta: LectureMeta | undefined = await db.get(STORE_LECTURES, id);
  if (!meta) return undefined;
  const audioBlob: Blob | undefined = await db.get(STORE_AUDIO, id);
  return { ...meta, audioBlob } as Lecture;
}

export async function getAllLectures(): Promise<Lecture[]> {
  const db = await getDB();
  const metas: LectureMeta[] = await db.getAll(STORE_LECTURES);
  return metas
    .map((m) => ({ ...m } as Lecture))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function deleteLecture(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_LECTURES, STORE_AUDIO], "readwrite");
  await tx.objectStore(STORE_LECTURES).delete(id);
  await tx.objectStore(STORE_AUDIO).delete(id);
  await tx.done;
}

export async function updateLecture(id: string, updates: Partial<Lecture>): Promise<void> {
  const db = await getDB();
  const existing: LectureMeta | undefined = await db.get(STORE_LECTURES, id);
  if (!existing) return;
  const { audioBlob, ...metaUpdates } = updates;
  const merged = { ...existing, ...metaUpdates };
  const tx = db.transaction([STORE_LECTURES, STORE_AUDIO], "readwrite");
  await tx.objectStore(STORE_LECTURES).put(merged);
  if (audioBlob) {
    await tx.objectStore(STORE_AUDIO).put(audioBlob, id);
  }
  await tx.done;
}
