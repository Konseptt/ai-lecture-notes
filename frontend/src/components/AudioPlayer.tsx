import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

interface Props {
  audioBlob?: Blob;
  onTimeUpdate?: (time: number) => void;
  seekTo?: number | null;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audioBlob, onTimeUpdate, seekTo }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [audioUrl, setAudioUrl] = useState<string>("");

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioBlob]);

  useEffect(() => {
    if (seekTo != null && audioRef.current) {
      audioRef.current.currentTime = seekTo;
    }
  }, [seekTo]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      onTimeUpdate?.(audioRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }

  function changeSpeed() {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function skip(seconds: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }

  if (!audioUrl) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-gray-400 dark:text-gray-600">
        No audio available
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (!audioRef.current) return;
          const d = audioRef.current.duration;
          if (isFinite(d) && d > 0) {
            setDuration(d);
          } else {
            // WebM blobs from MediaRecorder often report Infinity for duration.
            // Seek to a large value to force the browser to resolve the real duration.
            const audio = audioRef.current;
            audio.currentTime = 1e10;
            const onSeek = () => {
              audio.removeEventListener("seeked", onSeek);
              if (isFinite(audio.duration)) setDuration(audio.duration);
              audio.currentTime = 0;
            };
            audio.addEventListener("seeked", onSeek);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => setPlaying(false)}
      />

      {/* Progress bar */}
      <div className="cursor-pointer group mb-3" onClick={seek}>
        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono w-16">
          {formatTime(currentTime)}
        </span>

        <div className="flex items-center gap-3">
          <button onClick={() => skip(-10)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={() => skip(10)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 w-16 justify-end">
          <button
            onClick={changeSpeed}
            className="text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors tabular-nums"
          >
            {speed}x
          </button>
        </div>
      </div>

      <div className="text-center mt-1">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
