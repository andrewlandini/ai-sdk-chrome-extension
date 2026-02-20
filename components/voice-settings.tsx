"use client";

export interface VoiceConfig {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  label: string;
}

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Warm, narrative" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm, clear" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Soft, friendly" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", desc: "Well-rounded" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", desc: "Deep, confident" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", desc: "Dynamic, natural" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", desc: "Authoritative" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", desc: "Elegant, warm" },
];

const MODELS = [
  { id: "eleven_flash_v2_5", name: "Flash v2.5", desc: "Fast, low latency" },
  { id: "eleven_multilingual_v2", name: "Multilingual v2", desc: "Best quality" },
  { id: "eleven_turbo_v2_5", name: "Turbo v2.5", desc: "Balanced" },
  { id: "eleven_turbo_v2", name: "Turbo v2", desc: "Fast, stable" },
];

interface VoiceSettingsProps {
  config: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
}

export function VoiceSettings({ config, onChange }: VoiceSettingsProps) {
  const update = (partial: Partial<VoiceConfig>) =>
    onChange({ ...config, ...partial });

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Voice Settings</h3>
      </div>

      <div className="p-4 flex flex-col gap-5 bg-card">
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted font-medium uppercase tracking-wider">
            Version Label
          </label>
          <input
            type="text"
            value={config.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="e.g. v1-warm-slow"
            className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-accent placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Voice */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted font-medium uppercase tracking-wider">
            Voice
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => update({ voiceId: v.id })}
                className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                  config.voiceId === v.id
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border-light bg-background text-muted hover:text-foreground hover:border-border"
                }`}
              >
                <span className="font-medium">{v.name}</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {v.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted font-medium uppercase tracking-wider">
            Model
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => update({ modelId: m.id })}
                className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                  config.modelId === m.id
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border-light bg-background text-muted hover:text-foreground hover:border-border"
                }`}
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  {m.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stability slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted font-medium uppercase tracking-wider">
              Stability
            </label>
            <span className="text-xs text-muted font-mono tabular-nums">
              {config.stability.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.stability}
            onChange={(e) => update({ stability: parseFloat(e.target.value) })}
            className="w-full accent-accent h-1 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Variable</span>
            <span>Stable</span>
          </div>
        </div>

        {/* Similarity Boost slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted font-medium uppercase tracking-wider">
              Similarity Boost
            </label>
            <span className="text-xs text-muted font-mono tabular-nums">
              {config.similarityBoost.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.similarityBoost}
            onChange={(e) =>
              update({ similarityBoost: parseFloat(e.target.value) })
            }
            className="w-full accent-accent h-1 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
