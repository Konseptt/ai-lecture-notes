import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Pause, Play, Save, X, FileText } from "lucide-react";
import { saveLecture } from "../lib/storage";
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

  // Live transcription state
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
  const transcriptBoxRef = useRef<HTMLDivElement>(null);

  const getElapsedNow = useCallback(() => {
    if (state === "recording") {
      return pausedElapsed.current + (Date.now() - startTimeRef.current) / 1000;
    }
    return pausedElapsed.current;
  }, [state]);

  const updateAnalyser = useCallback(() => {
    if (analyserRef.current && state === "recording") {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      setAnalyserData(data.slice(0, 64));
      animFrameRef.current = requestAnimationFrame(updateAnalyser);
    }
  }, [state]);

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

  // Auto-scroll transcript box
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
        const trimmed = finalChunk.trim();
        if (trimmed) {
          const timestamp = formatTime(getElapsedNow());
          liveTextRef.current += (liveTextRef.current ? " " : "") + trimmed;
          setLiveText(liveTextRef.current);
          setSegments((prev) => [...prev, { time: timestamp, text: trimmed }]);
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("Speech recognition error:", event.error);
    };

    // Auto-restart on unexpected end while still recording
    recognition.onend = () => {
      if (recognitionRef.current && state === "recording") {
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

      // Reset transcription state
      liveTextRef.current = "";
      setLiveText("");
      setInterimText("");
      setSegments([]);

      setState("recording");
      startTimeRef.current = Date.now();
      pausedElapsed.current = 0;

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
      setState("paused");
      setAnalyserData(new Uint8Array(64));
      stopSpeechRecognition();
    }
  }

  function resumeRecording() {
    if (mediaRecorder.current?.state === "paused") {
      mediaRecorder.current.resume();
      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed(pausedElapsed.current + (Date.now() - startTimeRef.current) / 1000);
      }, 200);
      setState("recording");
      startSpeechRecognition();
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      clearInterval(timerRef.current);
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
    setLiveText("");
    setInterimText("");
    setSegments([]);
  }

  async function saveRecording() {
    if (!audioBlob) return;
    setSaving(true);

    const lecture: Lecture = {
      id: crypto.randomUUID(),
      title: title.trim() || `Lecture ${new Date().toLocaleDateString()}`,
      course: course.trim(),
      date: new Date().toISOString(),
      duration: Math.round(elapsed),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      audioBlob,
      transcript: {
        transcript: liveText,
        segments,
      },
      status: "transcribed",
    };

    await saveLecture(lecture);
    setSaving(false);
    navigate(`/lecture/${lecture.id}`);
  }

  const barCount = 48;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const idx = Math.floor((i / barCount) * analyserData.length);
    return analyserData[idx] / 255;
  });

  const hasSpeechAPI = !!getSpeechRecognition();

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold">Record Lecture</h1>

      {!hasSpeechAPI && state === "idle" && (
        <div className="w-full max-w-2xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-xl p-3 text-sm text-yellow-700 dark:text-yellow-400">
          Live transcription requires Chrome or Edge. Other browsers will record audio but won't transcribe in real-time.
        </div>
      )}

      {/* Waveform visualizer */}
      <div className="flex items-end justify-center gap-[3px] h-24 w-full max-w-lg">
        {bars.map((v, i) => (
          <div
            key={i}
            className="w-2 rounded-full bg-indigo-500 transition-all duration-75"
            style={{ height: `${Math.max(4, v * 100)}%`, opacity: state === "recording" ? 0.6 + v * 0.4 : 0.2 }}
          />
        ))}
      </div>

      {/* Timer */}
      <div className="text-5xl font-mono font-bold tabular-nums tracking-wider">
        {formatTime(elapsed)}
      </div>

      {/* Status */}
      <div className="text-sm font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {state === "idle" && "Ready to record"}
        {state === "recording" && (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Recording & Transcribing Live
          </span>
        )}
        {state === "paused" && "Paused"}
        {state === "stopped" && "Recording complete"}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95"
          >
            <Mic className="w-6 h-6" />
            Start Recording
          </button>
        )}
        {state === "recording" && (
          <>
            <button
              onClick={pauseRecording}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          </>
        )}
        {state === "paused" && (
          <>
            <button
              onClick={resumeRecording}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
            >
              <Play className="w-5 h-5" />
              Resume
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          </>
        )}
      </div>

      {/* Live transcript panel */}
      {state !== "idle" && (
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold">Live Transcript</span>
            {state === "recording" && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Listening...
              </span>
            )}
            {segments.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{segments.length} segments</span>
            )}
          </div>
          <div
            ref={transcriptBoxRef}
            className="p-4 max-h-64 overflow-y-auto space-y-2 text-sm leading-relaxed"
          >
            {segments.length === 0 && !interimText ? (
              <p className="text-gray-400 dark:text-gray-600 italic">
                {state === "recording"
                  ? "Start speaking... transcript will appear here in real-time"
                  : state === "stopped"
                  ? "No speech was detected during the recording"
                  : "Transcription paused"}
              </p>
            ) : (
              <>
                {segments.map((seg, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-xs font-mono text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded mt-0.5">
                      {seg.time}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">{seg.text}</span>
                  </div>
                ))}
                {interimText && (
                  <div className="flex gap-2">
                    <span className="shrink-0 text-xs font-mono text-gray-400 px-1.5 py-0.5 rounded mt-0.5">
                      ...
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 italic">{interimText}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Save form */}
      {state === "stopped" && audioBlob && (
        <div className="w-full max-w-md flex flex-col gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold">Save Recording</h2>
          {liveText && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Transcript captured: {liveText.split(" ").length} words, {segments.length} segments
            </p>
          )}
          <input
            type="text"
            placeholder="Lecture title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Course name (optional)"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-3">
            <button
              onClick={saveRecording}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save & Generate Notes"}
            </button>
            <button
              onClick={discardRecording}
              className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 px-6 py-3 rounded-xl font-semibold transition-all"
            >
              <X className="w-5 h-5" />
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
