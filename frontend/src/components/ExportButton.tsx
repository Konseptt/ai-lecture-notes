import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { getAudioBlob } from "../lib/storage";
import type { Lecture } from "../lib/types";

interface Props {
  lecture: Lecture;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 100);
}

function buildTranscriptText(l: Lecture): string {
  const lines = [`# ${l.title}`, `Course: ${l.course || "N/A"}`, `Date: ${new Date(l.date).toLocaleDateString()}`, "", "## Transcript", ""];
  if (l.transcript) {
    if (l.transcript.segments.length > 0) l.transcript.segments.forEach((s) => lines.push(`[${s.time}] ${s.text}`, ""));
    else lines.push(l.transcript.transcript);
  }
  return lines.join("\n");
}

function buildSummaryText(l: Lecture): string {
  if (!l.summary) return "";
  const lines = [`# ${l.title} — Summary`, "", "## Quick Summary"];
  l.summary.quick.points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push("", "## Detailed");
  l.summary.detailed.sections.forEach((s) => { lines.push(`### ${s.heading}`, s.content, ""); });
  return lines.join("\n");
}

function buildNotesText(l: Lecture): string {
  if (!l.notes) return "";
  const lines = [`# ${l.notes.title}`, ""];
  l.notes.sections.forEach((s) => {
    lines.push(`## ${s.heading}`);
    s.bullets.forEach((b) => lines.push(`- ${b}`));
    s.definitions.forEach((d) => lines.push(`  ${d.term}: ${d.definition}`));
    lines.push("");
  });
  if (l.notes.action_items.length) { lines.push("## Action Items"); l.notes.action_items.forEach((a) => lines.push(`[ ] ${a}`)); }
  return lines.join("\n");
}

function exportPDF(l: Lecture) {
  const doc = new jsPDF();
  const margin = 15;
  const pw = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  function add(text: string, size: number, bold = false) {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    for (const line of doc.splitTextToSize(text, pw)) {
      if (y > 280) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += size * 0.5;
    }
    y += 2;
  }
  add(l.title, 18, true);
  add(`${l.course || "N/A"} | ${new Date(l.date).toLocaleDateString()}`, 10);
  y += 4;
  if (l.transcript) { add("Transcript", 14, true); y += 2; if (l.transcript.segments.length) l.transcript.segments.forEach((s) => add(`[${s.time}] ${s.text}`, 9)); else add(l.transcript.transcript, 9); y += 4; }
  if (l.summary) { add("Quick Summary", 14, true); y += 2; l.summary.quick.points.forEach((p, i) => add(`${i + 1}. ${p}`, 9)); y += 4; }
  if (l.notes) { add("Notes", 14, true); y += 2; l.notes.sections.forEach((s) => { add(s.heading, 11, true); s.bullets.forEach((b) => add(`• ${b}`, 9)); }); }
  doc.save(`${sanitize(l.title)}.pdf`);
}

export default function ExportButton({ lecture }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function downloadAudio() {
    const blob = await getAudioBlob(lecture.id);
    if (blob) {
      downloadBlob(blob, `${sanitize(lecture.title)}.webm`);
    }
    setOpen(false);
  }

  function downloadTxt(content: string, suffix: string) {
    downloadBlob(new Blob([content], { type: "text/plain" }), `${sanitize(lecture.title)}_${suffix}.txt`);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 py-1 overflow-hidden" style={{ background: "var(--surface)" }}>
          {lecture.transcript && (
            <button onClick={() => downloadTxt(buildTranscriptText(lecture), "transcript")} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              Transcript
            </button>
          )}
          {lecture.summary && (
            <button onClick={() => downloadTxt(buildSummaryText(lecture), "summary")} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              Summary
            </button>
          )}
          {lecture.notes && (
            <button onClick={() => downloadTxt(buildNotesText(lecture), "notes")} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              Notes
            </button>
          )}
          <button onClick={() => { exportPDF(lecture); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            Full PDF
          </button>
          <hr className="my-1 border-neutral-100 dark:border-neutral-800" />
          <button onClick={downloadAudio} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            Audio
          </button>
        </div>
      )}
    </div>
  );
}
