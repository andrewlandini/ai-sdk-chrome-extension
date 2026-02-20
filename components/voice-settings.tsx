"use client";

export interface VoiceConfig {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  label: string;
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

interface VoiceSettingsProps {
  config: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
}

export function VoiceSettings({ config, onChange }: VoiceSettingsProps) {
  const update = (partial: Partial<VoiceConfig>) =>
    onChange({ ...config, ...partial });

  return (
    <section
      className="rounded-lg border border-border bg-surface-1 overflow-hidden"
      aria-labelledby="voice-heading"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id="voice-heading" className="text-sm font-medium text-foreground">
          Voice Settings
        </h2>
      </div>

      <div className="p-4 flex flex-col gap-5">
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

        {/* Divider */}
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
