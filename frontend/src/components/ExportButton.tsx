import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileDown, Music } from "lucide-react";
import { jsPDF } from "jspdf";
import type { Lecture } from "../lib/types";
import { getLecture } from "../lib/storage";

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

function buildTranscriptText(lecture: Lecture): string {
  const lines: string[] = [];
  lines.push(`# ${lecture.title}`);
  lines.push(`Course: ${lecture.course || "N/A"}`);
  lines.push(`Date: ${new Date(lecture.date).toLocaleDateString()}`);
  lines.push("");
  lines.push("## Transcript");
  lines.push("");
  if (lecture.transcript) {
    if (lecture.transcript.segments.length > 0) {
      for (const seg of lecture.transcript.segments) {
        lines.push(`[${seg.time}] ${seg.text}`);
        lines.push("");
      }
    } else {
      lines.push(lecture.transcript.transcript);
    }
  }
  return lines.join("\n");
}

function buildSummaryText(lecture: Lecture): string {
  const lines: string[] = [];
  lines.push(`# ${lecture.title} - Summary`);
  lines.push("");

  if (lecture.summary) {
    lines.push("## Quick Summary");
    lecture.summary.quick.points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push("");

    lines.push("## Detailed Summary");
    for (const sec of lecture.summary.detailed.sections) {
      lines.push(`### ${sec.heading}`);
      lines.push(sec.content);
      lines.push("");
    }

    lines.push("## Exam-Focused Summary");
    if (lecture.summary.exam.definitions.length > 0) {
      lines.push("### Definitions");
      for (const d of lecture.summary.exam.definitions) {
        lines.push(`- ${d.term}: ${d.definition}`);
      }
      lines.push("");
    }
    if (lecture.summary.exam.potential_questions.length > 0) {
      lines.push("### Potential Exam Questions");
      for (const q of lecture.summary.exam.potential_questions) {
        lines.push(`Q: ${q.question}`);
        lines.push(`   Hint: ${q.hint}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function buildNotesText(lecture: Lecture): string {
  const lines: string[] = [];
  if (!lecture.notes) return "";
  lines.push(`# ${lecture.notes.title}`);
  lines.push("");

  for (const sec of lecture.notes.sections) {
    lines.push(`## ${sec.heading}`);
    for (const b of sec.bullets) lines.push(`- ${b}`);
    if (sec.definitions.length > 0) {
      lines.push("");
      lines.push("Definitions:");
      for (const d of sec.definitions) lines.push(`  ${d.term}: ${d.definition}`);
    }
    if (sec.highlights.length > 0) {
      lines.push("");
      lines.push("Key Points:");
      for (const h of sec.highlights) lines.push(`  ★ ${h}`);
    }
    if (sec.examples.length > 0) {
      lines.push("");
      lines.push("Examples:");
      for (const e of sec.examples) lines.push(`  → ${e}`);
    }
    if (sec.formulas.length > 0) {
      lines.push("");
      lines.push("Formulas:");
      for (const f of sec.formulas) lines.push(`  ${f}`);
    }
    lines.push("");
  }

  if (lecture.notes.action_items.length > 0) {
    lines.push("## Action Items");
    for (const a of lecture.notes.action_items) lines.push(`☐ ${a}`);
    lines.push("");
  }

  if (lecture.notes.key_terms.length > 0) {
    lines.push("## Glossary");
    for (const kt of lecture.notes.key_terms) lines.push(`${kt.term}: ${kt.definition}`);
  }

  return lines.join("\n");
}

function exportPDF(lecture: Lecture) {
  const doc = new jsPDF();
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  function addText(text: string, fontSize: number, bold = false) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, pageWidth);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += fontSize * 0.5;
    }
    y += 2;
  }

  addText(lecture.title, 18, true);
  addText(`Course: ${lecture.course || "N/A"} | Date: ${new Date(lecture.date).toLocaleDateString()}`, 10);
  y += 5;

  if (lecture.transcript) {
    addText("Transcript", 14, true);
    y += 2;
    if (lecture.transcript.segments.length > 0) {
      for (const seg of lecture.transcript.segments) {
        addText(`[${seg.time}] ${seg.text}`, 9);
      }
    } else {
      addText(lecture.transcript.transcript, 9);
    }
    y += 5;
  }

  if (lecture.summary) {
    addText("Quick Summary", 14, true);
    y += 2;
    lecture.summary.quick.points.forEach((p, i) => addText(`${i + 1}. ${p}`, 9));
    y += 5;

    addText("Detailed Summary", 14, true);
    y += 2;
    for (const sec of lecture.summary.detailed.sections) {
      addText(sec.heading, 11, true);
      addText(sec.content, 9);
    }
    y += 5;
  }

  if (lecture.notes) {
    addText("Structured Notes", 14, true);
    y += 2;
    for (const sec of lecture.notes.sections) {
      addText(sec.heading, 11, true);
      for (const b of sec.bullets) addText(`• ${b}`, 9);
    }
  }

  doc.save(`${lecture.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}

export default function ExportButton({ lecture }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function downloadAudio() {
    const full = await getLecture(lecture.id);
    if (full?.audioBlob) {
      downloadBlob(full.audioBlob, `${lecture.title.replace(/[^a-zA-Z0-9]/g, "_")}.webm`);
    }
    setOpen(false);
  }

  function downloadTxt(content: string, suffix: string) {
    const blob = new Blob([content], { type: "text/plain" });
    downloadBlob(blob, `${lecture.title.replace(/[^a-zA-Z0-9]/g, "_")}_${suffix}.txt`);
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {lecture.transcript && (
            <button
              onClick={() => downloadTxt(buildTranscriptText(lecture), "transcript")}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <FileText className="w-4 h-4 text-blue-500" />
              Transcript (.txt)
            </button>
          )}
          {lecture.summary && (
            <button
              onClick={() => downloadTxt(buildSummaryText(lecture), "summary")}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <FileText className="w-4 h-4 text-purple-500" />
              Summary (.txt)
            </button>
          )}
          {lecture.notes && (
            <button
              onClick={() => downloadTxt(buildNotesText(lecture), "notes")}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <FileText className="w-4 h-4 text-green-500" />
              Notes (.txt)
            </button>
          )}
          <button
            onClick={() => { exportPDF(lecture); setOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <FileDown className="w-4 h-4 text-red-500" />
            Full Report (.pdf)
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-800" />
          <button
            onClick={downloadAudio}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Music className="w-4 h-4 text-indigo-500" />
            Audio (.webm)
          </button>
        </div>
      )}
    </div>
  );
}
