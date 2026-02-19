import { useState } from "react";
import type { TranscriptData } from "../lib/types";

interface Props {
  data: TranscriptData;
  onTimestampClick?: (seconds: number) => void;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export default function TranscriptPanel({ data, onTimestampClick }: Props) {
  const [search, setSearch] = useState("");
  const segments = data.segments.length > 0 ? data.segments : [{ time: "0:00", text: data.transcript }];
  const q = search.toLowerCase();
  const filtered = q ? segments.filter((s) => s.text.toLowerCase().includes(q)) : segments;

  function highlight(text: string) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-900/40 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div>
      {segments.length > 3 && (
        <input
          type="text"
          placeholder="Search transcript..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-4 px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-[var(--accent)] focus:outline-none text-sm placeholder:text-neutral-400 transition-colors"
        />
      )}

      <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">No results</p>
        ) : (
          filtered.map((seg, i) => (
            <div key={i} className="flex gap-3 py-1.5 group">
              <button
                onClick={() => onTimestampClick?.(parseTimestamp(seg.time))}
                className="shrink-0 text-[11px] font-mono tabular-nums text-neutral-400 hover:accent transition-colors mt-0.5"
              >
                {seg.time}
              </button>
              <p className="text-sm leading-relaxed">{highlight(seg.text)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
