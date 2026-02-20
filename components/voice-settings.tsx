"use client";

import useSWR from "swr";

export interface VoiceConfig {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  label: string;
  testMode: boolean;
}

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
];

const MODELS = [
  { id: "eleven_flash_v2_5", name: "Flash v2.5" },
  { id: "eleven_multilingual_v2", name: "Multi v2" },
  { id: "eleven_turbo_v2_5", name: "Turbo v2.5" },
  { id: "eleven_turbo_v2", name: "Turbo v2" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VoiceSettingsProps {
  config: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
}

export function VoiceSettings({ config, onChange }: VoiceSettingsProps) {
  const update = (partial: Partial<VoiceConfig>) =>
    onChange({ ...config, ...partial });

  const { data: credits } = useSWR<{
    tier: string;
    characterCount: number;
    characterLimit: number;
    nextResetUnix: number;
  }>("/api/credits", fetcher, { refreshInterval: 30000 });

  const usedPercent = credits
    ? Math.round((credits.characterCount / credits.characterLimit) * 100)
    : 0;
  const remaining = credits
    ? credits.characterLimit - credits.characterCount
    : null;

  return (
    <section
      className="rounded-lg border border-border bg-surface-1 overflow-hidden"
      aria-labelledby="voice-heading"
    >
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 id="voice-heading" className="text-sm font-medium text-foreground">
          Voice Settings
        </h2>
        {/* Test Mode toggle */}
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

      <div className="p-4 flex flex-col gap-5">
        {/* Credits bar */}
        {credits && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">
                ElevenLabs Credits
              </span>
              <span className="text-xs text-muted font-mono tabular-nums">
                {credits.tier}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPercent > 90
                    ? "bg-red-500"
                    : usedPercent > 70
                      ? "bg-amber-500"
                      : "bg-accent"
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted font-mono tabular-nums">
                {remaining?.toLocaleString()} chars remaining
              </span>
              <span className="text-[11px] text-muted font-mono tabular-nums">
                {credits.characterCount.toLocaleString()} / {credits.characterLimit.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {credits && <hr className="border-border" />}

        {/* Test mode banner */}
        {config.testMode && (
          <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 9v4m0 4h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            Test mode: AI will generate a short 1-paragraph script to save credits
          </div>
        )}

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
          <div className="flex flex-wrap gap-1.5">
            {VOICES.map((v) => {
              const selected = config.voiceId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => update({ voiceId: v.id })}
                  aria-pressed={selected}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-all focus-ring ${
                    selected
                      ? "bg-foreground text-background"
                      : "bg-surface-2 text-muted border border-border hover:text-foreground hover:border-border-hover"
                  }`}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Model */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs text-muted font-medium">Model</legend>
          <div className="flex flex-wrap gap-1.5">
            {MODELS.map((m) => {
              const selected = config.modelId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => update({ modelId: m.id })}
                  aria-pressed={selected}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-all focus-ring ${
                    selected
                      ? "bg-foreground text-background"
                      : "bg-surface-2 text-muted border border-border hover:text-foreground hover:border-border-hover"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* Stability */}
        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="stability" className="text-xs text-muted font-medium">
              Stability
            </label>
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
            <span>Variable</span>
            <span>Stable</span>
          </div>
        </fieldset>

        {/* Similarity Boost */}
        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="similarity" className="text-xs text-muted font-medium">
              Similarity Boost
            </label>
            <output className="text-xs text-foreground font-mono tabular-nums" htmlFor="similarity">
              {config.similarityBoost.toFixed(2)}
            </output>
          </div>
          <input
            id="similarity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.similarityBoost}
            onChange={(e) =>
              update({ similarityBoost: parseFloat(e.target.value) })
            }
            className="focus-ring rounded"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
