import { useState } from "react";
import { Search } from "lucide-react";
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

  const segments = data.segments.length > 0 ? data.segments : [{ time: "00:00:00", text: data.transcript }];
  const q = search.toLowerCase();

  const filtered = q
    ? segments.filter((s) => s.text.toLowerCase().includes(q))
    : segments;

  function highlight(text: string) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search transcript..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No matching text found</p>
        ) : (
          filtered.map((seg, i) => (
            <div key={i} className="group flex gap-3">
              <button
                onClick={() => onTimestampClick?.(parseTimestamp(seg.time))}
                className="shrink-0 text-xs font-mono text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-lg transition-colors mt-0.5"
              >
                {seg.time}
              </button>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {highlight(seg.text)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
