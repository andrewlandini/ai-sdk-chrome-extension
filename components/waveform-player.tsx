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

function truncateHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={`text-sm font-medium truncate text-balance ${idle ? "text-muted" : "text-foreground"}`}>
            {idle ? "No audio loaded" : title}
          </h3>
          {!idle && summary && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">
              {summary}
            </p>
          )}
        </div>
        {!idle && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors flex-shrink-0 mt-0.5 font-mono focus-ring rounded"
            aria-label={`Open ${truncateHost(url)} in new tab`}
          >
            {truncateHost(url)}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
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
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <svg fill="currentColor" className="h-3 w-auto" viewBox="0 0 56 56" aria-hidden="true">
            <path d="M 26.6875 12.6602 C 26.9687 12.6602 27.1094 12.4961 27.1797 12.2383 C 27.9062 8.3242 27.8594 8.2305 31.9375 7.4570 C 32.2187 7.4102 32.3828 7.2461 32.3828 6.9648 C 32.3828 6.6836 32.2187 6.5195 31.9375 6.4726 C 27.8828 5.6524 28.0000 5.5586 27.1797 1.6914 C 27.1094 1.4336 26.9687 1.2695 26.6875 1.2695 C 26.4062 1.2695 26.2656 1.4336 26.1953 1.6914 C 25.3750 5.5586 25.5156 5.6524 21.4375 6.4726 C 21.1797 6.5195 20.9922 6.6836 20.9922 6.9648 C 20.9922 7.2461 21.1797 7.4102 21.4375 7.4570 C 25.5156 8.2774 25.4687 8.3242 26.1953 12.2383 C 26.2656 12.4961 26.4062 12.6602 26.6875 12.6602 Z M 15.3438 28.7852 C 15.7891 28.7852 16.0938 28.5039 16.1406 28.0821 C 16.9844 21.8242 17.1953 21.8242 23.6641 20.5821 C 24.0860 20.5117 24.3906 20.2305 24.3906 19.7852 C 24.3906 19.3633 24.0860 19.0586 23.6641 18.9883 C 17.1953 18.0977 16.9609 17.8867 16.1406 11.5117 C 16.0938 11.0899 15.7891 10.7852 15.3438 10.7852 C 14.9219 10.7852 14.6172 11.0899 14.5703 11.5352 C 13.7969 17.8164 13.4687 17.7930 7.0469 18.9883 C 6.6250 19.0821 6.3203 19.3633 6.3203 19.7852 C 6.3203 20.2539 6.6250 20.5117 7.1406 20.5821 C 13.5156 21.6133 13.7969 21.7774 14.5703 28.0352 C 14.6172 28.5039 14.9219 28.7852 15.3438 28.7852 Z M 31.2344 54.7305 C 31.8438 54.7305 32.2891 54.2852 32.4062 53.6524 C 34.0703 40.8086 35.8750 38.8633 48.5781 37.4570 C 49.2344 37.3867 49.6797 36.8945 49.6797 36.2852 C 49.6797 35.6758 49.2344 35.2070 48.5781 35.1133 C 35.8750 33.7070 34.0703 31.7617 32.4062 18.9180 C 32.2891 18.2852 31.8438 17.8633 31.2344 17.8633 C 30.6250 17.8633 30.1797 18.2852 30.0860 18.9180 C 28.4219 31.7617 26.5938 33.7070 13.9140 35.1133 C 13.2344 35.2070 12.7891 35.6758 12.7891 36.2852 C 12.7891 36.8945 13.2344 37.3867 13.9140 37.4570 C 26.5703 39.1211 28.3281 40.8321 30.0860 53.6524 C 30.1797 54.2852 30.6250 54.7305 31.2344 54.7305 Z" />
          </svg>
          <span className="text-[10px] font-medium">AI SDK</span>
        </span>
        <span className="flex items-center text-muted-foreground">
          <svg viewBox="0 0 694 90" fill="currentColor" className="h-2 w-auto" role="img" aria-label="ElevenLabs">
            <path d="M248.261 22.1901H230.466L251.968 88.5124H271.123L292.625 22.1901H274.83L261.365 72.1488L248.261 22.1901Z" />
            <path d="M0 0H18.413V88.5124H0V0Z" />
            <path d="M36.5788 0H54.9917V88.5124H36.5788V0Z" />
            <path d="M73.1551 0H127.652V14.7521H91.568V35.8264H125.181V50.5785H91.568V73.7603H127.652V88.5124H73.1551V0Z" />
            <path d="M138.896 0H156.32V88.5124H138.896V0Z" />
            <path d="M166.824 55.2893C166.824 31.1157 178.811 20.7025 197.471 20.7025C216.131 20.7025 226.759 30.9917 226.759 55.5372V59.5041H184.001C184.619 73.8843 188.944 78.719 197.224 78.719C203.773 78.719 207.851 74.876 208.593 68.1818H226.017C224.905 82.8099 212.795 90 197.224 90C177.452 90 166.824 79.4628 166.824 55.2893ZM209.582 47.9752C208.717 35.8264 204.515 31.8595 197.224 31.8595C189.933 31.8595 185.36 35.9504 184.125 47.9752H209.582Z" />
            <path d="M295.962 55.2893C295.962 31.1157 307.949 20.7025 326.609 20.7025C345.269 20.7025 355.897 30.9917 355.897 55.5372V59.5041H313.139C313.757 73.8843 318.082 78.719 326.362 78.719C332.911 78.719 336.989 74.876 337.731 68.1818H355.155C354.043 82.8099 341.932 90 326.362 90C306.589 90 295.962 79.4628 295.962 55.2893ZM338.719 47.9752C337.854 35.8264 333.653 31.8595 326.362 31.8595C319.071 31.8595 314.498 35.9504 313.263 47.9752H338.719Z" />
            <path d="M438.443 0H456.856V73.7603H491.457V88.5124H438.443V0Z" />
            <path fillRule="evenodd" clipRule="evenodd" d="M495.783 55.2893C495.783 30 507.399 20.7025 522.352 20.7025C529.766 20.7025 536.563 24.9174 539.282 29.3802V22.1901H557.077V88.5124H539.776V80.7025C537.181 85.9091 529.89 90 521.857 90C506.04 90 495.783 79.8347 495.783 55.2893ZM526.924 33.719C535.574 33.719 540.27 40.2893 540.27 55.2893C540.27 70.2893 535.574 76.9835 526.924 76.9835C518.274 76.9835 513.331 70.2893 513.331 55.2893C513.331 40.2893 518.274 33.719 526.924 33.719Z" />
            <path fillRule="evenodd" clipRule="evenodd" d="M587.847 80.7025V88.5124H570.547V0H587.971V29.3802C590.937 24.7934 597.857 20.7025 605.272 20.7025C619.854 20.7025 631.47 30 631.47 55.2893C631.47 80.5785 620.101 90 604.901 90C596.869 90 590.319 85.9091 587.847 80.7025ZM600.329 33.843C608.979 33.843 613.922 40.2893 613.922 55.2893C613.922 70.2893 608.979 76.9835 600.329 76.9835C591.678 76.9835 586.982 70.2893 586.982 55.2893C586.982 40.2893 591.678 33.843 600.329 33.843Z" />
            <path d="M638.638 68.8017H656.062C656.309 75.7438 660.016 79.0909 666.566 79.0909C673.115 79.0909 676.823 76.1157 676.823 70.9091C676.823 66.1983 673.981 64.4628 667.802 62.9752L662.488 61.6116C647.412 57.7686 639.873 53.6777 639.873 41.157C639.873 28.6364 651.49 20.7025 666.319 20.7025C681.148 20.7025 692.394 26.5289 692.888 40.2893H675.463C675.093 34.2149 671.385 31.6116 666.072 31.6116C660.758 31.6116 657.05 34.2149 657.05 39.1736C657.05 43.7603 660.016 45.4959 665.207 46.7355L670.644 48.0992C684.979 51.6942 694 55.2893 694 68.6777C694 82.0661 682.137 90 666.072 90C648.647 90 639.008 83.4297 638.638 68.8017Z" />
            <path d="M384.072 49.4628C384.072 39.0496 389.015 33.3471 396.677 33.3471C402.979 33.3471 406.563 37.314 406.563 45.8678V88.5124H423.987V43.1405C423.987 27.7686 415.337 20.7025 402.732 20.7025C394.205 20.7025 387.162 25.0413 384.072 30.7438V22.1901H366.401V88.5124H384.072V49.4628Z" />
          </svg>
        </span>
      </div>
    </section>
  );
}
