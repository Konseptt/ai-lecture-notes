import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface Props {
  audioUrl?: string;
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

export default function AudioPlayer({ audioUrl, onTimeUpdate, seekTo }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

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
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  }

  function changeSpeed() {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  if (!audioUrl) {
    return <div className="py-4 text-sm text-neutral-400 text-center">No audio available</div>;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4" style={{ background: "var(--surface)" }}>
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
          if (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
            setDuration(audioRef.current.duration);
        }}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        <span className="text-[11px] font-mono text-neutral-400 tabular-nums w-10 shrink-0">{formatTime(currentTime)}</span>

        <div className="flex-1 cursor-pointer group" onClick={seek}>
          <div className="h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <span className="text-[11px] font-mono text-neutral-400 tabular-nums w-10 text-right shrink-0">{formatTime(duration)}</span>

        <button
          onClick={changeSpeed}
          className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 tabular-nums transition-colors"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
