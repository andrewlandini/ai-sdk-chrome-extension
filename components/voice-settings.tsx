"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";

export interface VoiceConfig {
  voiceId: string;
  stability: number;
  label: string;
  styleVibe: string;
}

interface VoicePreset {
  id: number;
  name: string;
  voice_id: string;
  stability: number;
}

// Voice IDs -- names and descriptions are fetched dynamically from the ElevenLabs API
const VOICE_IDS = [
  "PIGsltMj3gFMR34aFDI3", // Jonathan Livingston
  "UgBBYS2sOqTuMpoF3BR0", // Mark
  "X03mvPuTfprif8QBAVeJ", // Christina
  "tnSpp4vdxKPjI9w0GnoV", // Hope
  "kPzsL2i3teMYv0FxEYQ6", // Brittney
  "15CVCzDByBinCIoCblXo", // Lucan Rook
  "q0IMILNRPxOgtBTS4taI", // Drew
  "6u6JbqKdaQy89ENzLSju", // Brielle
  "fDeOZu1sNd7qahm2fV4k", // Luna
  "yr43K8H5LoTp6S1QFSGg", // Matt
  "eXpIbVcVbLo8ZJQDlDnl", // Siren
  "IoYPiP0wwoQzmraBbiju", // Patrick
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Exported so other components (e.g. VersionsList) can look up voice names
export function getVoiceName(id: string, meta?: Record<string, { name: string; desc?: string }> | null) {
  return meta?.[id]?.name ?? id.slice(0, 8);
}

interface VoiceSettingsProps {
  config: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
  isGenerating?: boolean;
  generateStatus?: string;
}

export function VoiceSettings({ config, onChange, isGenerating = false, generateStatus = "" }: VoiceSettingsProps) {
  const update = (partial: Partial<VoiceConfig>) =>
    onChange({ ...config, ...partial });

  const [presetName, setPresetName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  const { data: presetsData, mutate: mutatePresets } = useSWR<{
    presets: VoicePreset[];
  }>("/api/presets", fetcher);

  const presets = presetsData?.presets ?? [];

  const { data: voicePreviewData } = useSWR<{
    voices: Record<string, string>;
    voiceMeta: Record<string, { name: string; desc: string; gender: string; accent?: string; age?: string; useCase?: string; category?: string }>;
  }>("/api/voices", fetcher);
  const previewUrls = voicePreviewData?.voices ?? {};
  const voiceMeta = voicePreviewData?.voiceMeta ?? {};
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
                      {getVoiceName(preset.voice_id, voiceMeta)} / stability {preset.stability.toFixed(2)}
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
          {VOICE_IDS.map((vid) => {
            const meta = voiceMeta[vid];
            const vName = meta?.name ?? vid.slice(0, 8);
            const vDesc = meta?.desc ?? "";
            const vAccent = meta?.accent ?? "";
            const vGender = meta?.gender ?? "";
            const isSelected = config.voiceId === vid;
            const isPlaying = playingVoiceId === vid;
            const hasPreview = !!previewUrls[vid];
            const tag = [vGender, vAccent].filter(Boolean).join(" / ");

            return (
              <div
                key={vid}
                className={`group flex items-center min-h-[36px] rounded-md transition-colors border ${
                  isSelected
                    ? "bg-accent/15 border-accent/30"
                    : "border-transparent hover:bg-surface-2"
                }`}
              >
                {/* Preview button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasPreview) handlePreview(vid);
                  }}
                  aria-label={isPlaying ? `Stop ${vName} preview` : `Preview ${vName}`}
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
                  onClick={() => update({ voiceId: vid })}
                  aria-pressed={isSelected}
                  className="flex-1 min-w-0 flex items-center gap-2 pr-3 py-1.5 text-left focus-ring rounded-r-md h-full"
                >
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-medium leading-tight ${isSelected ? "text-accent" : "text-foreground"}`}>{vName}</span>
                    {vDesc && <span className="text-[10px] text-muted-foreground leading-tight truncate">{vDesc}</span>}
                  </div>
                  {tag && <span className="text-[9px] text-muted-foreground/60 flex-shrink-0 ml-auto">{tag}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Stability */}
      <fieldset className="flex flex-col gap-1.5 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs text-muted font-medium">Stability</legend>
          <output className="text-xs text-foreground font-mono tabular-nums">
            {config.stability.toFixed(2)}
          </output>
        </div>
        <div className="px-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.stability}
            onChange={(e) => update({ stability: parseFloat(e.target.value) })}
            className="w-full focus-ring rounded"
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground -mt-0.5 px-2">
          <span>Creative</span>
          <span>Robust</span>
        </div>
      </fieldset>

      {/* Generation progress */}
      {isGenerating && (
        <div className="flex flex-col gap-1.5 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <svg className="animate-spin flex-shrink-0 text-accent" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] text-accent font-medium">Generating audio...</span>
          </div>
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse transition-all" style={{ width: "100%" }} />
          </div>
          {generateStatus && (
            <p className="text-[10px] text-muted font-mono truncate">
              {generateStatus}
            </p>
          )}
        </div>
      )}

    </section>
  );
}
