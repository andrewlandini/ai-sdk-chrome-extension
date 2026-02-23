"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";
import { PronunciationDictPopup } from "./pronunciation-dict";

export type TtsProvider = "elevenlabs" | "inworld";

export interface VoiceConfig {
  voiceId: string;
  stability: number;
  label: string;
  styleVibe: string;
  ttsProvider: TtsProvider;
  // InWorld-specific settings
  inworldModel?: string;
  inworldTemperature?: number;
  inworldSpeakingRate?: number;
}

interface VoicePreset {
  id: number;
  name: string;
  voice_id: string;
  tts_provider: string;
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

const INWORLD_MODELS = [
  { id: "inworld-tts-1.5-max", name: "TTS 1.5 Max", desc: "Flagship — best quality + speed" },
  { id: "inworld-tts-1.5-mini", name: "TTS 1.5 Mini", desc: "Ultra-fast, most cost-efficient" },
  { id: "inworld-tts-1-max", name: "TTS 1.0 Max", desc: "Previous gen — powerful" },
  { id: "inworld-tts-1", name: "TTS 1.0", desc: "Previous gen — fastest" },
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

  const { data: inworldVoicesData } = useSWR<{
    voices: { voiceId: string; name: string; gender: string; desc: string; tags?: string[] }[];
  }>("/api/inworld-voices", fetcher);
  const inworldVoices = inworldVoicesData?.voices ?? [];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [dictOpen, setDictOpen] = useState(false);

  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const handlePreview = useCallback((voiceId: string, provider?: TtsProvider) => {
    // If already playing this voice, stop it
    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Determine the preview URL
    const activeProvider = provider || config.ttsProvider;
    let url: string;
    if (activeProvider === "inworld") {
      url = `/api/inworld-preview?voiceId=${encodeURIComponent(voiceId)}`;
    } else {
      url = previewUrls[voiceId];
      if (!url) return;
    }

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);
    setLoadingPreviewId(voiceId);

    audio.play()
      .then(() => setLoadingPreviewId(null))
      .catch(() => { setPlayingVoiceId(null); setLoadingPreviewId(null); });
    audio.addEventListener("ended", () => setPlayingVoiceId(null), { once: true });
    audio.addEventListener("error", () => { setPlayingVoiceId(null); setLoadingPreviewId(null); }, { once: true });
  }, [previewUrls, playingVoiceId, config.ttsProvider]);

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
          tts_provider: config.ttsProvider,
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
      ttsProvider: (preset.tts_provider as TtsProvider) || "elevenlabs",
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

      {/* TTS Provider toggle */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs text-muted font-medium">TTS Provider</legend>
        <div className="flex bg-surface-2 rounded-md p-0.5 gap-0.5">
          <button
            onClick={() => update({ ttsProvider: "elevenlabs", voiceId: VOICE_IDS[0] })}
            className={`flex-1 text-xs font-medium py-1.5 rounded transition-colors focus-ring ${
              config.ttsProvider === "elevenlabs"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            ElevenLabs
          </button>
          <button
            onClick={() => update({ ttsProvider: "inworld", voiceId: inworldVoices[0]?.voiceId || "Alex" })}
            className={`flex-1 text-xs font-medium py-1.5 rounded transition-colors focus-ring ${
              config.ttsProvider === "inworld"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            InWorld AI
          </button>
        </div>
      </fieldset>

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

      {/* Training Words */}
      <button
        onClick={() => setDictOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-border hover:border-border-hover bg-surface-2/30 hover:bg-surface-2 transition-colors text-left focus-ring"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent flex-shrink-0" aria-hidden="true">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground">Training Words</span>
          <span className="text-[10px] text-muted-foreground ml-1.5">Pronunciation dictionary</span>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <PronunciationDictPopup open={dictOpen} onClose={() => setDictOpen(false)} />

      {/* Voice */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted font-medium">Voice</legend>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={voiceSearch}
            onChange={(e) => setVoiceSearch(e.target.value)}
            placeholder="Filter voices..."
            className="w-full h-7 bg-background border border-border rounded-md pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/40 focus-ring"
          />
          {voiceSearch && (
            <button
              onClick={() => setVoiceSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex flex-col gap-0.5 max-h-[360px] overflow-y-auto">
          {config.ttsProvider === "elevenlabs" ? (() => {
            const q = voiceSearch.toLowerCase();
            const filteredIds = VOICE_IDS.filter((vid) => {
              if (!q) return true;
              const meta = voiceMeta[vid];
              const searchable = [
                meta?.name ?? vid,
                meta?.desc ?? "",
                meta?.gender ?? "",
                meta?.accent ?? "",
                meta?.useCase ?? "",
                meta?.category ?? "",
              ].join(" ").toLowerCase();
              return searchable.includes(q);
            });
            return filteredIds.length === 0 ? (
              <p className="text-[11px] text-muted py-2 text-center">No voices match &ldquo;{voiceSearch}&rdquo;</p>
            ) : filteredIds.map((vid) => {
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
            });
          })() : (() => {
            // InWorld AI voices
            if (inworldVoices.length === 0) return (
              <p className="text-[11px] text-muted py-2">Loading InWorld voices...</p>
            );
            const q = voiceSearch.toLowerCase();
            const filteredInworld = inworldVoices.filter((v) => {
              if (!q) return true;
              const searchable = [v.name, v.desc, v.gender, ...(v.tags || [])].join(" ").toLowerCase();
              return searchable.includes(q);
            });
            return filteredInworld.length === 0 ? (
              <p className="text-[11px] text-muted py-2 text-center">No voices match &ldquo;{voiceSearch}&rdquo;</p>
            ) : filteredInworld.map((v) => {
                const isSelected = config.voiceId === v.voiceId;
                const isPlaying = playingVoiceId === v.voiceId;
                const isLoading = loadingPreviewId === v.voiceId;
                return (
                  <div
                    key={v.voiceId}
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
                        handlePreview(v.voiceId, "inworld");
                      }}
                      aria-label={isPlaying ? `Stop ${v.name} preview` : `Preview ${v.name}`}
                      className={`flex items-center justify-center w-8 h-full flex-shrink-0 rounded-l-md transition-colors focus-ring ${
                        isPlaying
                          ? "text-accent"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isLoading ? (
                        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : isPlaying ? (
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
                      onClick={() => update({ voiceId: v.voiceId })}
                      aria-pressed={isSelected}
                      className="flex-1 min-w-0 flex items-center gap-2 pr-3 py-1.5 text-left focus-ring rounded-r-md h-full"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-medium leading-tight ${isSelected ? "text-accent" : "text-foreground"}`}>{v.name}</span>
                        {v.desc && <span className="text-[10px] text-muted-foreground leading-tight truncate">{v.desc}</span>}
                      </div>
                      {v.gender && <span className="text-[9px] text-muted-foreground/60 flex-shrink-0 ml-auto">{v.gender}</span>}
                    </button>
                  </div>
                );
              });
          })()}
        </div>
      </fieldset>

      {/* Stability (ElevenLabs only) */}
      {config.ttsProvider === "elevenlabs" && (
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
      )}

      {/* InWorld settings */}
      {config.ttsProvider === "inworld" && (
        <>
          {/* Model */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs text-muted font-medium">Model</legend>
            <div className="flex flex-col gap-0.5">
              {INWORLD_MODELS.map((m) => {
                const isSelected = (config.inworldModel || "inworld-tts-1.5-max") === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => update({ inworldModel: m.id })}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors border ${
                      isSelected
                        ? "bg-accent/15 border-accent/30"
                        : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-medium leading-tight ${isSelected ? "text-accent" : "text-foreground"}`}>{m.name}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{m.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Temperature */}
          <fieldset className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <legend className="text-xs text-muted font-medium">Temperature</legend>
              <output className="text-xs text-foreground font-mono tabular-nums">
                {(config.inworldTemperature ?? 1.1).toFixed(1)}
              </output>
            </div>
            <div className="px-2">
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={config.inworldTemperature ?? 1.1}
                onChange={(e) => update({ inworldTemperature: parseFloat(e.target.value) })}
                className="w-full focus-ring rounded"
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground -mt-0.5 px-2">
              <span>Deterministic</span>
              <span>Expressive</span>
            </div>
          </fieldset>

          {/* Speaking Rate */}
          <fieldset className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <legend className="text-xs text-muted font-medium">Speaking Rate</legend>
              <output className="text-xs text-foreground font-mono tabular-nums">
                {(config.inworldSpeakingRate ?? 1.0).toFixed(1)}x
              </output>
            </div>
            <div className="px-2">
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={config.inworldSpeakingRate ?? 1.0}
                onChange={(e) => update({ inworldSpeakingRate: parseFloat(e.target.value) })}
                className="w-full focus-ring rounded"
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground -mt-0.5 px-2">
              <span>0.5x Slow</span>
              <span>1.0x Normal</span>
              <span>1.5x Fast</span>
            </div>
          </fieldset>
        </>
      )}

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
