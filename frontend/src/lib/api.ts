import type { SummaryData, NotesData } from "./types";

const BASE = "/api";

export async function summarizeTranscript(transcript: string): Promise<SummaryData> {
  const res = await fetch(`${BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Summary generation failed");
  }
  return res.json();
}

export async function generateNotes(transcript: string): Promise<NotesData> {
  const res = await fetch(`${BASE}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Note generation failed");
  }
  return res.json();
}
