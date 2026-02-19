import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Trash2,
  Mic,
  Clock,
  BookOpen,
  Tag,
  CheckCircle,
  Loader2,
  AlertCircle,
  FileAudio,
} from "lucide-react";
import { getAllLectures, deleteLecture } from "../lib/storage";
import type { Lecture } from "../lib/types";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  recording: { label: "Recording", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  transcribed: { label: "Transcribed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: <FileAudio className="w-3 h-3" /> },
  summarizing: { label: "Summarizing", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  generating_notes: { label: "Notes", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  complete: { label: "Complete", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="w-3 h-3" /> },
  error: { label: "Error", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <AlertCircle className="w-3 h-3" /> },
};

export default function LectureList() {
  const navigate = useNavigate();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLectures();
  }, []);

  async function loadLectures() {
    setLoading(true);
    const all = await getAllLectures();
    setLectures(all);
    setLoading(false);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this lecture? This cannot be undone.")) return;
    await deleteLecture(id);
    setLectures((prev) => prev.filter((l) => l.id !== id));
  }

  const courses = Array.from(new Set(lectures.map((l) => l.course).filter(Boolean)));

  const filtered = lectures.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.title.toLowerCase().includes(q) ||
      l.course.toLowerCase().includes(q) ||
      l.tags.some((t) => t.toLowerCase().includes(q));
    const matchesCourse = !filterCourse || l.course === filterCourse;
    return matchesSearch && matchesCourse;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button
          onClick={() => navigate("/record")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
        >
          <Mic className="w-4 h-4" />
          New Recording
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search lectures..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {courses.length > 0 && (
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lecture list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileAudio className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            {lectures.length === 0 ? "No lectures yet" : "No matching lectures"}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {lectures.length === 0 ? "Start by recording your first lecture" : "Try a different search"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lecture) => {
            const badge = STATUS_BADGES[lecture.status] || STATUS_BADGES.recorded;
            return (
              <Link
                key={lecture.id}
                to={`/lecture/${lecture.id}`}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                  <FileAudio className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{lecture.title}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(lecture.duration)}
                    </span>
                    {lecture.course && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {lecture.course}
                      </span>
                    )}
                    <span>{new Date(lecture.date).toLocaleDateString()}</span>
                  </div>
                  {lecture.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Tag className="w-3 h-3 text-gray-400" />
                      {lecture.tags.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(lecture.id, e)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
