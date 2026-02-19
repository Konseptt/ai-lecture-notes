import type { SummaryData, NotesData, Lecture } from "./types";

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("lecturai_token");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function summarizeTranscript(transcript: string, lectureId?: string): Promise<SummaryData> {
  const res = await fetch(`${BASE}/summarize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ transcript, lecture_id: lectureId }),
  });
  return handleResponse(res);
}

export async function generateNotes(transcript: string, lectureId?: string): Promise<NotesData> {
  const res = await fetch(`${BASE}/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ transcript, lecture_id: lectureId }),
  });
  return handleResponse(res);
}

export async function fetchLectures(): Promise<Lecture[]> {
  const res = await fetch(`${BASE}/lectures`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchLecture(id: string): Promise<Lecture> {
  const res = await fetch(`${BASE}/lectures/${id}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function createLecture(data: {
  title: string;
  course: string;
  date: string;
  duration: number;
  tags: string[];
  transcript?: { transcript: string; segments: { time: string; text: string }[] };
  status?: string;
}): Promise<Lecture> {
  const res = await fetch(`${BASE}/lectures`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateLectureAPI(id: string, updates: Partial<Lecture>): Promise<Lecture> {
  const res = await fetch(`${BASE}/lectures/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
}

export async function deleteLectureAPI(id: string): Promise<void> {
  const res = await fetch(`${BASE}/lectures/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Delete failed");
  }
}

export async function uploadAudio(lectureId: string, blob: Blob): Promise<void> {
  const token = getToken();
  const form = new FormData();
  form.append("file", blob, `${lectureId}.webm`);
  const res = await fetch(`${BASE}/audio/${lectureId}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
}

export function getAudioUrl(lectureId: string): string {
  return `${BASE}/audio/${lectureId}`;
}
