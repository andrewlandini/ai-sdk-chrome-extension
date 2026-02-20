"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";

export interface VoiceConfig {
  voiceId: string;
  stability: number;
  label: string;
  testMode: boolean;
  styleVibe: string;
}

interface VoicePreset {
  id: number;
  name: string;
  voice_id: string;
  stability: number;
}

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

  const { data: voicePreviewData } = useSWR<{ voices: Record<string, string> }>("/api/voices", fetcher);
  const previewUrls = voicePreviewData?.voices ?? {};
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const handlePreview = useCallback((voiceId: string) => {
    const url = previewUrls[voiceId];
    if (!url) return;

    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

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
          stability: config.stability,
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

  const handleDeletePreset = async (id: number, name: string) => {
    if (!window.confirm(`Delete voice preset "${name}"? This cannot be undone.`)) return;
    await fetch("/api/presets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutatePresets();
  };

  return (
    <section className="flex flex-col gap-5" aria-labelledby="voice-heading">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 id="voice-heading" className="text-sm font-semibold tracking-tight">Voice Settings</h2>
          <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">v3</span>
        </div>
        <button
          onClick={() => update({ testMode: !config.testMode })}
          aria-pressed={config.testMode}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all border focus-ring ${
            config.testMode
              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
              : "bg-surface-2 text-muted border-border hover:text-foreground hover:border-border-hover"
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

      {/* Credits */}
      {credits && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Credits</span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usedPercent > 90 ? "bg-red-500" : usedPercent > 70 ? "bg-amber-500" : "bg-accent"
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums flex-shrink-0">
            {credits.characterCount.toLocaleString()} / {credits.characterLimit.toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground">{credits.tier}</span>
        </div>
      )}

      {config.testMode && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 9v4m0 4h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          Test mode: short script to save credits
        </div>
      )}

      {/* Presets */}
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs text-muted font-medium">Presets</legend>
          {!showSaveInput && (
            <button
              onClick={() => setShowSaveInput(true)}
              className="text-xs text-accent hover:text-accent/80 font-medium transition-colors focus-ring rounded px-1"
            >
              + Save current
            </button>
          )}
        </div>

        {showSaveInput && (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              placeholder="Preset name..."
              autoFocus
              className="flex-1 h-8 bg-background border border-border rounded-md px-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus-ring"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim() || isSaving}
              className="h-8 px-3 rounded-md text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
            >
              {isSaving ? "..." : "Save"}
            </button>
            <button
              onClick={() => { setShowSaveInput(false); setPresetName(""); }}
              className="h-8 px-2 rounded-md text-xs text-muted hover:text-foreground focus-ring"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {presets.length > 0 && (
          <div className="flex flex-col gap-1">
            {presets.map((preset) => {
              const isActive =
                config.voiceId === preset.voice_id &&
                config.stability === preset.stability;

              return (
                <div
                  key={preset.id}
                  className={`group flex items-center gap-2 rounded-md px-3 py-2 transition-colors cursor-pointer ${
                    isActive
                      ? "bg-accent/10 border border-accent/20"
                      : "bg-surface-2 border border-transparent hover:border-border-hover"
                  }`}
                  onClick={() => handleLoadPreset(preset)}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium block ${isActive ? "text-accent" : "text-foreground"}`}>
                      {preset.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {getVoiceName(preset.voice_id)} / stability {preset.stability.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id, preset.name); }}
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted hover:text-destructive transition-all focus-ring"
                    aria-label={`Delete preset ${preset.name}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </fieldset>

      {/* Version label */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs text-muted font-medium">Version Label</legend>
        <input
          type="text"
          value={config.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="e.g. v1-warm-slow"
          className="h-8 bg-background border border-border rounded-md px-2.5 text-xs text-foreground font-mono placeholder:text-muted-foreground/40 transition-colors focus-ring"
        />
      </fieldset>

      {/* Voice */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted font-medium">Voice</legend>
        <div className="flex flex-col gap-0.5">
          {VOICES.map((v) => {
            const isSelected = config.voiceId === v.id;
            const isPlaying = playingVoiceId === v.id;
            const hasPreview = !!previewUrls[v.id];

            return (
              <div
                key={v.id}
                className={`group flex items-center h-8 rounded-md transition-colors border ${
                  isSelected
                    ? "bg-accent/15 border-accent/30"
                    : "border-transparent hover:bg-surface-2"
                }`}
              >
                {/* Preview button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasPreview) handlePreview(v.id);
                  }}
                  aria-label={isPlaying ? `Stop ${v.name} preview` : `Preview ${v.name}`}
                  disabled={!hasPreview}
                  className={`flex items-center justify-center w-8 h-full flex-shrink-0 rounded-l-md transition-colors focus-ring ${
                    !hasPreview
                      ? "text-muted-foreground/20 cursor-default"
                      : isPlaying
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isPlaying ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>
                {/* Voice select button */}
                <button
                  onClick={() => update({ voiceId: v.id })}
                  aria-pressed={isSelected}
                  className="flex-1 min-w-0 flex items-center gap-3 pr-3 py-1 text-left focus-ring rounded-r-md h-full"
                >
                  <span className={`text-xs font-medium ${isSelected ? "text-accent" : "text-foreground"}`}>{v.name}</span>
                  <span className="text-[10px] text-muted-foreground">{v.desc}</span>
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Stability */}
      <fieldset className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <legend className="text-xs text-muted font-medium">Stability</legend>
          <output className="text-xs text-foreground font-mono tabular-nums">
            {config.stability.toFixed(2)}
          </output>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.stability}
          onChange={(e) => update({ stability: parseFloat(e.target.value) })}
          className="w-full focus-ring rounded"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground -mt-0.5">
          <span>Creative</span>
          <span>Robust</span>
        </div>
      </fieldset>

      {/* Style / Vibe */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted font-medium">Style / Vibe</legend>
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Confident", value: "Confident and genuinely excited about the content, but grounded and conversational -- not over the top" },
            { label: "Calm narrator", value: "Calm, measured narrator with a warm tone -- like a documentary voiceover" },
            { label: "Podcast host", value: "Friendly podcast host, casual and upbeat, speaking to the audience like a friend" },
            { label: "Newscast", value: "Professional news anchor delivery -- clear, authoritative, with crisp pacing" },
            { label: "Storyteller", value: "Engaging storyteller, building suspense and drawing listeners in with pacing and emphasis" },
            { label: "Minimal", value: "Minimal, understated delivery -- let the words speak for themselves with no embellishment" },
          ].map((preset) => {
            const isActive = config.styleVibe === preset.value;
            return (
              <button
                key={preset.label}
                onClick={() => update({ styleVibe: isActive ? "" : preset.value })}
                className={`h-6 px-2 rounded text-[10px] font-medium transition-colors focus-ring ${
                  isActive
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "bg-surface-2 text-muted-foreground border border-transparent hover:text-foreground hover:border-border"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <textarea
          rows={4}
          value={config.styleVibe}
          onChange={(e) => update({ styleVibe: e.target.value })}
          placeholder="Custom vibe, e.g. warm bedtime story, dramatic trailer..."
          className="bg-background border border-border rounded-md px-2.5 py-2 text-xs text-foreground leading-relaxed placeholder:text-muted-foreground/30 transition-colors focus-ring resize-none"
        />
      </fieldset>
    </section>
  );
}
