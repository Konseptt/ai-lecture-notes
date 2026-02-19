import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Zap,
  BookOpen,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { getLecture, updateLecture } from "../lib/storage";
import { summarizeTranscript, generateNotes } from "../lib/api";
import type { Lecture } from "../lib/types";
import AudioPlayer from "./AudioPlayer";
import TranscriptPanel from "./TranscriptPanel";
import SummaryPanel from "./SummaryPanel";
import NotesPanel from "./NotesPanel";
import ExportButton from "./ExportButton";

type Tab = "transcript" | "summary" | "notes";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "transcript", label: "Transcript", icon: <FileText className="w-4 h-4" /> },
  { key: "summary", label: "Summaries", icon: <Zap className="w-4 h-4" /> },
  { key: "notes", label: "Notes", icon: <BookOpen className="w-4 h-4" /> },
];

export default function LectureView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    getLecture(id).then((l) => {
      if (l) setLecture(l);
      else navigate("/");
    });
  }, [id, navigate]);

  useEffect(() => {
    if (lecture && lecture.status === "transcribed" && !processedRef.current) {
      processedRef.current = true;
      processLecture();
    }
  }, [lecture]);

  async function processLecture() {
    if (!lecture?.transcript?.transcript) {
      setError("No transcript available. Please re-record with speech recognition enabled.");
      return;
    }
    setProcessing(true);
    setError("");

    try {
      setProcessingStep("Generating summaries...");
      await updateLecture(lecture.id, { status: "summarizing" });
      setLecture((l) => l && { ...l, status: "summarizing" });

      const summary = await summarizeTranscript(lecture.transcript.transcript);
      await updateLecture(lecture.id, { summary, status: "generating_notes" });
      setLecture((l) => l && { ...l, summary, status: "generating_notes" });

      setProcessingStep("Creating structured notes...");
      const notes = await generateNotes(lecture.transcript.transcript);
      await updateLecture(lecture.id, { notes, status: "complete" });
      setLecture((l) => l && { ...l, notes, status: "complete" });
    } catch (err: any) {
      const msg = err?.message || "Processing failed";
      setError(msg);
      await updateLecture(lecture.id, { status: "error", errorMessage: msg });
      setLecture((l) => l && { ...l, status: "error", errorMessage: msg });
    } finally {
      setProcessing(false);
      setProcessingStep("");
    }
  }

  function handleRetry() {
    if (!lecture) return;
    processedRef.current = false;
    setError("");
    setLecture({ ...lecture, status: "transcribed" });
  }

  if (!lecture) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const hasTranscript = !!lecture.transcript;
  const hasSummary = !!lecture.summary;
  const hasNotes = !!lecture.notes;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lecture.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {lecture.course && <span>{lecture.course}</span>}
            <span>{new Date(lecture.date).toLocaleDateString()}</span>
          </div>
        </div>
        {lecture.status === "complete" && (
          <ExportButton lecture={lecture} />
        )}
      </div>

      {/* Processing indicator */}
      {processing && (
        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl p-4">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <div>
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{processingStep}</p>
            <p className="text-xs text-indigo-500 dark:text-indigo-500 mt-0.5">Using AI to analyze your transcript...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Processing failed</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="px-4 py-2 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Audio player */}
      <AudioPlayer
        audioBlob={lecture.audioBlob}
        seekTo={seekTime}
        onTimeUpdate={() => {}}
      />

      {/* Generate AI notes button (if transcript exists but no summary/notes yet and not processing) */}
      {hasTranscript && !hasSummary && !hasNotes && !processing && !error && lecture.status !== "summarizing" && lecture.status !== "generating_notes" && (
        <button
          onClick={handleRetry}
          className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25"
        >
          <Sparkles className="w-5 h-5" />
          Generate AI Summaries & Notes
        </button>
      )}

      {/* Tabs */}
      {hasTranscript && (
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {TABS.map((t) => {
            const disabled =
              (t.key === "summary" && !hasSummary) ||
              (t.key === "notes" && !hasNotes);
            return (
              <button
                key={t.key}
                onClick={() => !disabled && setTab(t.key)}
                disabled={disabled}
                className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-white dark:bg-gray-900 shadow-sm text-indigo-600 dark:text-indigo-400"
                    : disabled
                    ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {t.icon}
                {t.label}
                {disabled && processing && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        {tab === "transcript" && hasTranscript && (
          <TranscriptPanel
            data={lecture.transcript!}
            onTimestampClick={(t) => setSeekTime(t)}
          />
        )}
        {tab === "summary" && hasSummary && (
          <SummaryPanel data={lecture.summary!} />
        )}
        {tab === "notes" && hasNotes && (
          <NotesPanel data={lecture.notes!} />
        )}
        {!hasTranscript && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700" />
            <p className="text-gray-500 dark:text-gray-400">
              No transcript available. The recording may not have captured any speech.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
