"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface WaveformPlayerProps {
  audioUrl?: string;
  title?: string;
  summary?: string;
  url?: string;
  autoplay?: boolean;
}

const SKIP_SECONDS = 10;
const BAR_WIDTH = 2;
const BAR_GAP = 1;
const MIN_HEIGHT_PCT = 6;
const MAX_BARS = 320;
const MIN_BARS = 60;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function extractPeaks(audioBuffer: AudioBuffer, barCount: number): number[] {
  const { length, numberOfChannels } = audioBuffer;
  const samplesPerBar = Math.floor(length / barCount);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }
  const peaks = new Array(barCount).fill(0);
  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = i === barCount - 1 ? length : start + samplesPerBar;
    let sumSq = 0;
    let count = 0;
    for (let s = start; s < end; s += 64) {
      let v = 0;
      for (let c = 0; c < numberOfChannels; c++) {
        v += channels[c][s] || 0;
      }
      v /= numberOfChannels;
      sumSq += v * v;
      count++;
    }
    peaks[i] = count ? Math.sqrt(sumSq / count) : 0;
  }
  const max = Math.max(1e-6, Math.max(...peaks));
  const normalized = peaks.map((p) => Math.pow(p / max, 0.5));
  const smoothed = new Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    const a = normalized[i - 1] ?? normalized[i];
    const b = normalized[i];
    const c = normalized[i + 1] ?? normalized[i];
    smoothed[i] = (a + 2 * b + c) / 4;
  }
  return smoothed;
}

function generatePlaceholderPeaks(count: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1);
    peaks.push(Math.max(MIN_HEIGHT_PCT / 100, 1 - Math.abs(2 * t - 1)));
  }
  return peaks;
}


export function WaveformPlayer({
  audioUrl = "",
  title = "Untitled",
  summary = "",
  url = "",
  autoplay = false,
}: WaveformPlayerProps) {
  const idle = !audioUrl;
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [barCount, setBarCount] = useState(120);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const el = waveformRef.current;
    if (!el) return;
    const updateBarCount = () => {
      const count = Math.min(
        MAX_BARS,
        Math.max(MIN_BARS, Math.floor(el.getBoundingClientRect().width / (BAR_WIDTH + BAR_GAP)))
      );
      setBarCount(count);
    };
    updateBarCount();
    const observer = new ResizeObserver(updateBarCount);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (idle || !audioUrl || barCount === 0) return;
    let cancelled = false;
    async function decodeAudio() {
      try {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
        if (!cancelled) {
          setPeaks(extractPeaks(audioBuffer, barCount));
          setIsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setPeaks(generatePlaceholderPeaks(barCount));
          setIsLoaded(true);
        }
      }
    }
    decodeAudio();
    return () => { cancelled = true; };
  }, [audioUrl, barCount]);

  useEffect(() => {
    if (!idle && autoplay && audioRef.current && isLoaded) {
      audioRef.current.play().catch(() => {});
    }
  }, [autoplay, isLoaded]);

  const startAnimation = useCallback(() => {
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => { setIsPlaying(true); startAnimation(); };
    const onPause = () => { setIsPlaying(false); stopAnimation(); };
    const onEnded = () => { setIsPlaying(false); stopAnimation(); };
    const onMeta = () => setDuration(audio.duration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onMeta);
      stopAnimation();
    };
  }, [startAnimation, stopAnimation]);

  useEffect(() => {
    return () => {
      stopAnimation();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopAnimation]);

  const togglePlayPause = () => {
    if (idle) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  const skip = (seconds: number) => {
    if (idle) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    setCurrentTime(audio.currentTime);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (idle) return;
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayPeaks = peaks.length > 0 ? peaks : generatePlaceholderPeaks(barCount);

  return (
    <section
      className="overflow-hidden"
      aria-label="Audio player"
    >
      {/* Header */}
      <div className="px-4 py-2 border-b border-border flex items-center">
        <h3 className={`text-xs font-medium truncate min-w-0 ${idle ? "text-muted" : "text-foreground"}`}>
          {idle ? "No audio loaded" : title}
        </h3>
      </div>

      {/* Waveform + Controls */}
      <div className="px-4 py-4">
        {!idle && <audio ref={audioRef} src={audioUrl} preload="auto" />}

        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          className="relative h-14 flex items-end cursor-pointer select-none"
          style={{ gap: `${BAR_GAP}px` }}
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          {/* Base layer */}
          <div className="absolute inset-0 flex items-end" style={{ gap: `${BAR_GAP}px` }}>
            {displayPeaks.map((peak, i) => (
              <span
                key={`b-${i}`}
                className="block rounded-[1px] bg-waveform-base"
                style={{
                  flex: `0 0 ${BAR_WIDTH}px`,
                  width: `${BAR_WIDTH}px`,
                  height: `${Math.max(MIN_HEIGHT_PCT, Math.round(peak * 100))}%`,
                  minHeight: "2px",
                }}
              />
            ))}
          </div>

          {/* Played overlay */}
          <div
            className="absolute top-0 left-0 h-full overflow-hidden flex items-end"
            style={{ width: `${progressPercent}%`, gap: `${BAR_GAP}px` }}
          >
            {displayPeaks.map((peak, i) => (
              <span
                key={`p-${i}`}
                className="block rounded-[1px] bg-waveform-played"
                style={{
                  flex: `0 0 ${BAR_WIDTH}px`,
                  width: `${BAR_WIDTH}px`,
                  height: `${Math.max(MIN_HEIGHT_PCT, Math.round(peak * 100))}%`,
                  minHeight: "2px",
                }}
              />
            ))}
          </div>
        </div>

        {/* Time + Transport */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted font-mono tabular-nums w-10">
            {formatTime(currentTime)}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => skip(-SKIP_SECONDS)}
              disabled={idle}
              className={`flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground hover:bg-surface-3 transition-colors focus-ring ${idle ? "opacity-30 cursor-default" : ""}`}
              aria-label={`Rewind ${SKIP_SECONDS} seconds`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="11 19 2 12 11 5 11 19" />
                <polygon points="22 19 13 12 22 5 22 19" />
              </svg>
            </button>

            <button
              onClick={togglePlayPause}
              disabled={idle}
              className={`flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors focus-ring ${idle ? "opacity-30 cursor-default" : ""}`}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5" aria-hidden="true">
                  <path d="M6 4v16l14-8z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => skip(SKIP_SECONDS)}
              disabled={idle}
              className={`flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground hover:bg-surface-3 transition-colors focus-ring ${idle ? "opacity-30 cursor-default" : ""}`}
              aria-label={`Forward ${SKIP_SECONDS} seconds`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="13 19 22 12 13 5 13 19" />
                <polygon points="2 19 11 12 2 5 2 19" />
              </svg>
            </button>
          </div>

          <span className="text-[11px] text-muted font-mono tabular-nums w-10 text-right">
            -{formatTime(Math.max(0, duration - currentTime))}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between">
        {idle ? (
          <span className="flex items-center gap-1.5 text-xs text-muted opacity-30 px-2 py-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download</span>
          </span>
        ) : (
        <a
          href={audioUrl}
          download={`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "audio"}.mp3`}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1"
          aria-label="Download audio"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Download</span>
        </a>
        )}
      </div>
    </section>
  );
}
