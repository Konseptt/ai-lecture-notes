import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Clock, Loader2 } from "lucide-react";
import { fetchLectures, deleteLectureAPI } from "../lib/api";
import type { Lecture } from "../lib/types";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 59) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusLabel: Record<string, string> = {
  recording: "recording...",
  transcribed: "ready",
  summarizing: "processing...",
  generating_notes: "processing...",
  complete: "done",
  error: "failed",
};

export default function LectureList() {
  const navigate = useNavigate();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLectures()
      .then((all) => { setLectures(all); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this lecture?")) return;
    await deleteLectureAPI(id);
    setLectures((prev) => prev.filter((l) => l.id !== id));
  }

  const q = search.toLowerCase();
  const filtered = lectures.filter(
    (l) => !q || l.title.toLowerCase().includes(q) || l.course.toLowerCase().includes(q)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Header area */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Library</h1>
          {lectures.length > 0 && (
            <p className="text-sm text-neutral-500 mt-1">
              {lectures.length} recording{lectures.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate("/record")}
          className="bg-accent text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + New recording
        </button>
      </div>

      {/* Search */}
      {lectures.length > 3 && (
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-6 px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-[var(--accent)] focus:outline-none text-sm placeholder:text-neutral-400 transition-colors"
        />
      )}

      {/* Empty state */}
      {lectures.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎙️</div>
          <h2 className="text-lg font-bold mb-1">No lectures yet</h2>
          <p className="text-sm text-neutral-500 mb-6 max-w-[260px] mx-auto">
            Record a lecture and we'll give you a transcript, summary, and study notes. For free.
          </p>
          <button
            onClick={() => navigate("/record")}
            className="bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Record your first lecture
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-sm text-neutral-400">No results for "{search}"</p>
      ) : (
        /* Lecture list - simple table-like rows */
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {filtered.map((lecture) => (
            <Link
              key={lecture.id}
              to={`/lecture/${lecture.id}`}
              className="group flex items-center gap-4 py-3.5 -mx-2 px-2 rounded-lg hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors"
            >
              {/* Color dot based on status */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                lecture.status === "complete" ? "bg-emerald-400" :
                lecture.status === "error" ? "bg-red-400" :
                lecture.status === "transcribed" ? "bg-amber-400" :
                "bg-neutral-300 dark:bg-neutral-600"
              }`} />

              {/* Title & course */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[15px] truncate block">{lecture.title}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {lecture.course && (
                    <span className="text-xs text-neutral-500">{lecture.course}</span>
                  )}
                  {lecture.tags.length > 0 && (
                    <span className="text-xs text-neutral-400">
                      {lecture.tags.slice(0, 2).join(", ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="hidden sm:flex items-center gap-4 text-xs text-neutral-400 shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(lecture.duration)}
                </span>
                <span className="w-16 text-right">{relativeDate(lecture.date)}</span>
                <span className={`w-20 text-right ${
                  lecture.status === "complete" ? "text-emerald-500" :
                  lecture.status === "error" ? "text-red-500" :
                  "text-neutral-400"
                }`}>
                  {statusLabel[lecture.status] || lecture.status}
                </span>
              </div>

              {/* Delete */}
              <button
                onClick={(e) => handleDelete(lecture.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-neutral-400 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
