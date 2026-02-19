import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Pause, Play, Save, X, FileText, AlertTriangle } from "lucide-react";
import { createLecture, uploadAudio } from "../lib/api";
import type { Lecture, TranscriptSegment } from "../lib/types";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function AudioRecorder() {
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [tags, setTags] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analyserData, setAnalyserData] = useState<Uint8Array>(new Uint8Array(64));
  const [saving, setSaving] = useState(false);

  const [liveText, setLiveText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pausedElapsed = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const liveTextRef = useRef("");
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);
  const pendingInterimRef = useRef("");

  function getElapsedSeconds(): number {
    if (!isRecordingRef.current) return pausedElapsed.current;
    return pausedElapsed.current + (Date.now() - startTimeRef.current) / 1000;
  }

  function commitText(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const timestamp = formatTime(getElapsedSeconds());
    liveTextRef.current += (liveTextRef.current ? " " : "") + trimmed;
    const newSeg: TranscriptSegment = { time: timestamp, text: trimmed };
    segmentsRef.current = [...segmentsRef.current, newSeg];
    setLiveText(liveTextRef.current);
    setSegments(segmentsRef.current);
  }

  const updateAnalyser = useCallback(() => {
    if (analyserRef.current && isRecordingRef.current) {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      setAnalyserData(data.slice(0, 64));
      animFrameRef.current = requestAnimationFrame(updateAnalyser);
    }
  }, []);

  useEffect(() => {
    if (state === "recording") {
      animFrameRef.current = requestAnimationFrame(updateAnalyser);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state, updateAnalyser]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopSpeechRecognition();
    };
  }, []);

  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [liveText, interimText]);

  function startSpeechRecognition() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalChunk += text;
        } else {
          interim += text;
        }
      }

      if (finalChunk) {
        commitText(finalChunk);
        pendingInterimRef.current = "";
      }

      pendingInterimRef.current = interim;
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      // When the session ends, any unfinalized interim text would be lost.
      // Commit it as a segment before restarting.
      if (pendingInterimRef.current.trim()) {
        commitText(pendingInterimRef.current);
        pendingInterimRef.current = "";
        setInterimText("");
      }

      if (isRecordingRef.current && recognitionRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }

  function stopSpeechRecognition() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onresult = null;
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setInterimText("");
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: recorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000);
      mediaRecorder.current = recorder;

      liveTextRef.current = "";
      segmentsRef.current = [];
      pendingInterimRef.current = "";
      setLiveText("");
      setInterimText("");
      setSegments([]);

      const now = Date.now();
      startTimeRef.current = now;
      recordingStartTimeRef.current = now;
      pausedElapsed.current = 0;
      isRecordingRef.current = true;
      setState("recording");

      timerRef.current = window.setInterval(() => {
        setElapsed(pausedElapsed.current + (Date.now() - startTimeRef.current) / 1000);
      }, 200);

      startSpeechRecognition();
    } catch (err) {
      alert("Microphone access denied. Please allow microphone access to record.");
    }
  }

  function pauseRecording() {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.pause();
      pausedElapsed.current += (Date.now() - startTimeRef.current) / 1000;
      clearInterval(timerRef.current);
      isRecordingRef.current = false;
      setState("paused");
      setAnalyserData(new Uint8Array(64));
      stopSpeechRecognition();
    }
  }

  function resumeRecording() {
    if (mediaRecorder.current?.state === "paused") {
      mediaRecorder.current.resume();
      startTimeRef.current = Date.now();
      isRecordingRef.current = true;
      setState("recording");

      timerRef.current = window.setInterval(() => {
        setElapsed(pausedElapsed.current + (Date.now() - startTimeRef.current) / 1000);
      }, 200);

      startSpeechRecognition();
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      clearInterval(timerRef.current);
      isRecordingRef.current = false;
      setState("stopped");
      setAnalyserData(new Uint8Array(64));
      stopSpeechRecognition();
    }
  }

  function discardRecording() {
    setAudioBlob(null);
    setElapsed(0);
    setState("idle");
    setTitle("");
    setCourse("");
    setTags("");
    liveTextRef.current = "";
    segmentsRef.current = [];
    pendingInterimRef.current = "";
    setLiveText("");
    setInterimText("");
    setSegments([]);
  }

  async function saveRecording() {
    if (!audioBlob) return;
    setSaving(true);

    try {
      const lecture = await createLecture({
        title: title.trim() || `Lecture ${new Date().toLocaleDateString()}`,
        course: course.trim(),
        date: new Date().toISOString(),
        duration: Math.round(elapsed),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        transcript: {
          transcript: liveText,
          segments: segmentsRef.current,
        },
        status: "transcribed",
      });

      await uploadAudio(lecture.id, audioBlob);
      navigate(`/lecture/${lecture.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to save recording");
    } finally {
      setSaving(false);
    }
  }

  const barCount = 32;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const idx = Math.floor((i / barCount) * analyserData.length);
    return analyserData[idx] / 255;
  });
  const hasSpeechAPI = !!getSpeechRecognition();
  const isActive = state === "recording";

  return (
    <div>
      {/* Two-column when recording: left = controls, right = transcript */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Record</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {state === "idle" && "Hit the button. We'll handle the rest."}
          {isActive && "Listening... speak normally."}
          {state === "paused" && "Paused. Take your time."}
          {state === "stopped" && "All done. Save it below."}
        </p>
      </div>

      {!hasSpeechAPI && state === "idle" && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          ⚠️ Live transcription needs Chrome or Edge. Audio still records in other browsers.
        </div>
      )}

      <div className={`${state !== "idle" && state !== "stopped" ? "grid grid-cols-1 lg:grid-cols-5 gap-6" : ""}`}>
        {/* Left: Recording controls */}
        <div className={state !== "idle" && state !== "stopped" ? "lg:col-span-2" : ""}>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col items-center gap-5" style={{ background: "var(--surface)" }}>
            {/* Big record button */}
            {state === "idle" ? (
              <button
                onClick={startRecording}
                className="group w-32 h-32 rounded-full bg-accent flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
              >
                <Mic className="w-10 h-10 text-white" />
              </button>
            ) : (
              <>
                {/* Waveform */}
                <div className="flex items-center justify-center gap-[3px] h-16 w-full">
                  {bars.map((v, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-100"
                      style={{
                        width: "3px",
                        height: `${Math.max(8, v * 100)}%`,
                        background: isActive
                          ? `var(--accent)`
                          : "rgb(212 212 212 / 0.4)",
                        opacity: isActive ? 0.4 + v * 0.6 : 0.3,
                      }}
                    />
                  ))}
                </div>

                {/* Timer */}
                <div className="font-mono text-4xl font-bold tabular-nums tracking-wider">
                  {formatTime(elapsed)}
                </div>

                {/* Status dot */}
                {isActive && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    recording
                  </div>
                )}
                {state === "paused" && (
                  <div className="text-xs text-neutral-400">paused</div>
                )}
              </>
            )}

            {/* Control buttons */}
            {state === "idle" && (
              <p className="text-xs text-neutral-400">tap to start</p>
            )}
            {isActive && (
              <div className="flex gap-2">
                <button onClick={pauseRecording} className="px-4 py-2 text-sm font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                  <Pause className="w-4 h-4 inline mr-1.5" />Pause
                </button>
                <button onClick={stopRecording} className="px-4 py-2 text-sm font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:opacity-90 transition-opacity">
                  <Square className="w-4 h-4 inline mr-1.5" />Stop
                </button>
              </div>
            )}
            {state === "paused" && (
              <div className="flex gap-2">
                <button onClick={resumeRecording} className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity">
                  <Play className="w-4 h-4 inline mr-1.5" />Resume
                </button>
                <button onClick={stopRecording} className="px-4 py-2 text-sm font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                  <Square className="w-4 h-4 inline mr-1.5" />Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live transcript (only while recording/paused) */}
        {state !== "idle" && state !== "stopped" && (
          <div className="lg:col-span-3 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden flex flex-col" style={{ background: "var(--surface)" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Transcript</span>
              {isActive && (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  live
                </span>
              )}
              {segments.length > 0 && !isActive && (
                <span className="text-[11px] text-neutral-400">{segments.length} segments</span>
              )}
            </div>
            <div
              ref={transcriptBoxRef}
              className="flex-1 p-4 max-h-80 overflow-y-auto scrollbar-thin space-y-2 text-sm"
            >
              {segments.length === 0 && !interimText ? (
                <p className="text-neutral-400 italic text-center py-8 text-xs">
                  {isActive ? "say something..." : "paused"}
                </p>
              ) : (
                <>
                  {segments.map((seg, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="shrink-0 text-[10px] font-mono text-neutral-400 tabular-nums mt-1">
                        {seg.time}
                      </span>
                      <span className="leading-relaxed">{seg.text}</span>
                    </div>
                  ))}
                  {interimText && (
                    <div className="flex gap-3">
                      <span className="shrink-0 text-[10px] font-mono text-neutral-300 dark:text-neutral-600 tabular-nums mt-1">
                        {formatTime(getElapsedSeconds())}
                      </span>
                      <span className="text-neutral-400 italic leading-relaxed">{interimText}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save form - shows after stopping */}
      {state === "stopped" && audioBlob && (
        <div className="mt-6 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5" style={{ background: "var(--surface)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg">Save this recording</h2>
              {liveText ? (
                <p className="text-xs text-emerald-600 mt-0.5">
                  ✓ {segments.length} segments, {liveText.split(/\s+/).length} words captured
                </p>
              ) : (
                <p className="text-xs text-neutral-400 mt-0.5">No transcript was captured.</p>
              )}
            </div>
            <span className="font-mono text-sm text-neutral-400 tabular-nums">{formatTime(elapsed)}</span>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title (e.g. Psych 101 — Memory)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-[var(--accent)] focus:outline-none text-sm transition-colors"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Course"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-[var(--accent)] focus:outline-none text-sm transition-colors"
              />
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-0 py-2 bg-transparent border-b border-neutral-200 dark:border-neutral-800 focus:border-[var(--accent)] focus:outline-none text-sm transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={saveRecording}
              disabled={saving}
              className="flex-1 bg-accent text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & generate notes →"}
            </button>
            <button
              onClick={discardRecording}
              className="px-4 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
