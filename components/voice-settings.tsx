"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";

export interface VoiceConfig {
  voiceId: string;
  stability: number;
  label: string;
  testMode: boolean;
}

interface VoicePreset {
  id: number;
  name: string;
  voice_id: string;
  stability: number;
}

// Curated v3-optimized voices for blog narration / podcast
const VOICES = [
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", desc: "Young, articulate" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", desc: "Deep, narrator" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "British, warm" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", desc: "British, authoritative" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", desc: "British, warm" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm, professional" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "News, clear" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", desc: "British, confident" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "Australian, casual" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", desc: "American, friendly" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", desc: "Intense, transatlantic" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", desc: "Casual, conversational" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getVoiceName(id: string) {
  return VOICES.find((v) => v.id === id)?.name ?? id;
}

interface VoiceSettingsProps {
  config: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
}

export function VoiceSettings({ config, onChange }: VoiceSettingsProps) {
  const update = (partial: Partial<VoiceConfig>) =>
    onChange({ ...config, ...partial });

  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  const { data: credits } = useSWR<{
    tier: string;
    characterCount: number;
    characterLimit: number;
    nextResetUnix: number;
  }>("/api/credits", fetcher, { refreshInterval: 30000 });

  const { data: presetsData, mutate: mutatePresets } = useSWR<{
    presets: VoicePreset[];
  }>("/api/presets", fetcher);

  const presets = presetsData?.presets ?? [];

  // Voice preview playback
  const { data: voicePreviewData } = useSWR<{ voices: Record<string, string> }>("/api/voices", fetcher);
  const previewUrls = voicePreviewData?.voices ?? {};
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const handlePreview = useCallback((voiceId: string) => {
    const url = previewUrls[voiceId];
    if (!url) return;

    // If already playing this voice, stop it
    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    // Stop any currently playing preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.play().catch(() => setPlayingVoiceId(null));
    audio.addEventListener("ended", () => setPlayingVoiceId(null), { once: true });
    audio.addEventListener("error", () => setPlayingVoiceId(null), { once: true });
  }, [previewUrls, playingVoiceId]);

  const usedPercent = credits
    ? Math.round((credits.characterCount / credits.characterLimit) * 100)
    : 0;
  const remaining = credits
    ? credits.characterLimit - credits.characterCount
    : null;

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    setIsSaving(true);
    try {
      await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: presetName.trim(),
          voice_id: config.voiceId,
          model_id: "eleven_v3",
          stability: config.stability,
          similarity_boost: 0,
        }),
      });
      setPresetName("");
      setShowSaveInput(false);
      mutatePresets();
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadPreset = (preset: VoicePreset) => {
    onChange({
      ...config,
      voiceId: preset.voice_id,
      stability: preset.stability,
    });
  };

  const handleDeletePreset = async (id: number) => {
    await fetch("/api/presets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutatePresets();
  };

  return (
    <section
      className="flex flex-col gap-0"
      aria-labelledby="voice-heading"
    >
      <div className="pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 id="voice-heading" className="text-sm font-medium text-foreground">
            Voice Settings
          </h2>
          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            v3
          </span>
        </div>
        <button
          onClick={() => update({ testMode: !config.testMode })}
          aria-pressed={config.testMode}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all focus-ring ${
            config.testMode
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "bg-surface-2 text-muted border border-border hover:text-foreground hover:border-border-hover"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 3h6l2 4H7L9 3Z" />
            <path d="M7 7v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" />
            <path d="M12 11v4" />
          </svg>
          Test
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {/* Credits bar */}
        {credits && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">ElevenLabs Credits</span>
              <span className="text-xs text-muted font-mono tabular-nums">{credits.tier}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPercent > 90 ? "bg-red-500" : usedPercent > 70 ? "bg-amber-500" : "bg-accent"
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted font-mono tabular-nums">
                {remaining?.toLocaleString()} remaining
              </span>
              <span className="text-[11px] text-muted font-mono tabular-nums">
                {credits.characterCount.toLocaleString()} / {credits.characterLimit.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {credits && <hr className="border-border" />}

        {config.testMode && (
          <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 9v4m0 4h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            Test mode: short 1-paragraph script to save credits
          </div>
        )}

        {/* Presets */}
        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <legend className="text-xs text-muted font-medium">Presets</legend>
            {!showSaveInput && (
              <button
                onClick={() => setShowSaveInput(true)}
                className="text-[11px] text-accent hover:text-accent/80 font-medium transition-colors focus-ring rounded"
              >
                + Save current
              </button>
            )}
          </div>

          {showSaveInput && (
            <div className="flex gap-2 animate-fade-in">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                placeholder="Preset name..."
                autoFocus
                className="flex-1 h-8 bg-background border border-border rounded-md px-2.5 text-xs text-foreground placeholder:text-muted-foreground/30 transition-colors focus-ring"
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim() || isSaving}
                className="h-8 px-3 rounded-md text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-ring"
              >
                {isSaving ? "..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowSaveInput(false);
                  setPresetName("");
                }}
                className="h-8 px-2 rounded-md text-xs text-muted hover:text-foreground transition-colors focus-ring"
              >
                Cancel
              </button>
            </div>
          )}

          {presets.length > 0 ? (
            <div className="flex flex-col gap-1">
              {presets.map((preset) => {
                const isActive =
                  config.voiceId === preset.voice_id &&
                  config.stability === preset.stability;

                return (
                  <div
                    key={preset.id}
                    className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-accent/10 border border-accent/20"
                        : "bg-surface-2 border border-transparent hover:border-border-hover"
                    }`}
                  >
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      className="flex-1 text-left focus-ring rounded"
                    >
                      <span className={`text-xs font-medium ${isActive ? "text-accent" : "text-foreground"}`}>
                        {preset.name}
                      </span>
                      <span className="block text-[10px] text-muted font-mono mt-0.5">
                        {getVoiceName(preset.voice_id)} / stability {preset.stability.toFixed(2)}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeletePreset(preset.id)}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted hover:text-destructive transition-all focus-ring"
                      aria-label={`Delete preset ${preset.name}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted py-1">
              No saved presets. Configure voice settings and save them for quick access.
            </p>
          )}
        </fieldset>

        <hr className="border-border" />

        {/* Version Label */}
        <fieldset className="flex flex-col gap-1.5">
          <label htmlFor="version-label" className="text-xs text-muted font-medium">
            Version Label
          </label>
          <input
            id="version-label"
            type="text"
            value={config.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="e.g. v1-warm-slow"
            className="h-9 bg-background border border-border rounded-md px-3 text-sm text-foreground font-mono placeholder:text-muted-foreground/30 transition-colors focus-ring"
          />
        </fieldset>

        {/* Voice */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs text-muted font-medium">Voice</legend>
          <div className="flex flex-col gap-1">
            {VOICES.map((v) => {
              const isSelected = config.voiceId === v.id;
              const isPlaying = playingVoiceId === v.id;
              const hasPreview = !!previewUrls[v.id];

              return (
                <div
                  key={v.id}
                  className={`group flex items-center rounded-md transition-all ${
                    isSelected
                      ? "bg-foreground text-background"
                      : "bg-surface-2 text-muted border border-transparent hover:text-foreground hover:border-border-hover"
                  }`}
                >
                  <button
                    onClick={() => update({ voiceId: v.id })}
                    aria-pressed={isSelected}
                    className="flex-1 flex items-center justify-between px-3 py-2 text-left focus-ring rounded-l-md"
                  >
                    <span className="text-xs font-medium">{v.name}</span>
                    <span className={`text-[10px] ${isSelected ? "text-background/60" : "text-muted-foreground"}`}>{v.desc}</span>
                  </button>
                  {hasPreview && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(v.id);
                      }}
                      aria-label={isPlaying ? `Stop ${v.name} preview` : `Preview ${v.name}`}
                      className={`flex items-center justify-center w-8 h-full rounded-r-md transition-colors focus-ring ${
                        isPlaying
                          ? isSelected ? "text-background" : "text-accent"
                          : isSelected ? "text-background/50 hover:text-background" : "text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isPlaying ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* Stability - Creative to Robust */}
        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="stability" className="text-xs text-muted font-medium">Stability</label>
            <output className="text-xs text-foreground font-mono tabular-nums" htmlFor="stability">
              {config.stability.toFixed(2)}
            </output>
          </div>
          <input
            id="stability"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.stability}
            onChange={(e) => update({ stability: parseFloat(e.target.value) })}
            className="focus-ring rounded"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Creative</span>
            <span>Robust</span>
          </div>
        </fieldset>

        {/* v3 info */}
        <div className="text-[11px] text-muted bg-surface-2 rounded-md px-3 py-2 leading-relaxed">
          Eleven v3 includes built-in text normalization. 5,000 char limit per chunk — longer scripts are automatically split and concatenated.
        </div>
      </div>
    </section>
  );
}
