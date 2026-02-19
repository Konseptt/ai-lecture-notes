import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Zap, BookOpen, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { fetchLecture, updateLectureAPI, summarizeTranscript, generateNotes } from "../lib/api";
import { getAudioBlob } from "../lib/storage";
import type { Lecture } from "../lib/types";
import AudioPlayer from "./AudioPlayer";
import TranscriptPanel from "./TranscriptPanel";
import SummaryPanel from "./SummaryPanel";
import NotesPanel from "./NotesPanel";
import ExportButton from "./ExportButton";

type Tab = "transcript" | "summary" | "notes";

export default function LectureView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    fetchLecture(id).then((l) => setLecture(l)).catch(() => navigate("/"));
    getAudioBlob(id).then((blob) => {
      if (blob) setAudioUrl(URL.createObjectURL(blob));
    });
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [id, navigate]);

  useEffect(() => {
    if (lecture && lecture.status === "transcribed" && !processedRef.current) {
      processedRef.current = true;
      processLecture();
    }
  }, [lecture]);

  async function processLecture() {
    if (!lecture?.transcript?.transcript) {
      setError("No transcript. Try re-recording with Chrome or Edge.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      setProcessingStep("Generating summaries...");
      await updateLectureAPI(lecture.id, { status: "summarizing" });
      setLecture((l) => l && { ...l, status: "summarizing" });

      const summary = await summarizeTranscript(lecture.transcript.transcript, lecture.id);
      setLecture((l) => l && { ...l, summary, status: "generating_notes" });

      setProcessingStep("Creating notes...");
      const notes = await generateNotes(lecture.transcript.transcript, lecture.id);
      setLecture((l) => l && { ...l, notes, status: "complete" });
    } catch (err: any) {
      const msg = err?.message || "Something went wrong";
      setError(msg);
      await updateLectureAPI(lecture.id, { status: "error", error_message: msg } as any);
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
    return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>;
  }

  const hasTranscript = !!lecture.transcript;
  const hasSummary = !!lecture.summary;
  const hasNotes = !!lecture.notes;

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "transcript", label: "Transcript", enabled: hasTranscript },
    { key: "summary", label: "Summary", enabled: hasSummary },
    { key: "notes", label: "Notes", enabled: hasNotes },
  ];

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate("/")} className="mt-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight truncate">{lecture.title}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {lecture.course && <>{lecture.course} · </>}
            {new Date(lecture.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {lecture.status === "complete" && <ExportButton lecture={lecture} />}
      </div>

      {/* Processing */}
      {processing && (
        <div className="mb-4 flex items-center gap-3 border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-3" style={{ background: "var(--surface)" }}>
          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
          <div>
            <p className="text-sm font-semibold">{processingStep}</p>
            <p className="text-xs text-neutral-400">this usually takes 10-20 seconds</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/10 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={handleRetry} className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400">
            retry
          </button>
        </div>
      )}

      {/* Audio player */}
      <div className="mb-6">
        <AudioPlayer audioUrl={audioUrl} seekTo={seekTime} onTimeUpdate={() => {}} />
      </div>

      {/* Generate button */}
      {hasTranscript && !hasSummary && !hasNotes && !processing && !error && lecture.status !== "summarizing" && lecture.status !== "generating_notes" && (
        <button
          onClick={handleRetry}
          className="mb-6 w-full bg-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate AI summaries & notes
        </button>
      )}

      {/* Tabs */}
      {hasTranscript && (
        <div className="flex gap-0 border-b border-neutral-200 dark:border-neutral-800 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => t.enabled && setTab(t.key)}
              disabled={!t.enabled}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-[var(--accent)] accent"
                  : !t.enabled
                  ? "border-transparent text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {t.label}
              {!t.enabled && processing && <Loader2 className="w-3 h-3 animate-spin inline ml-1.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5" style={{ background: "var(--surface)" }}>
        {tab === "transcript" && hasTranscript && (
          <TranscriptPanel data={lecture.transcript!} onTimestampClick={(t) => setSeekTime(t)} />
        )}
        {tab === "summary" && hasSummary && <SummaryPanel data={lecture.summary!} />}
        {tab === "notes" && hasNotes && <NotesPanel data={lecture.notes!} />}
        {!hasTranscript && (
          <div className="text-center py-12">
            <p className="text-6xl mb-3">📝</p>
            <p className="text-sm text-neutral-400">No transcript. The recording didn't capture any speech.</p>
          </div>
        )}
      </div>
    </div>
  );
}
