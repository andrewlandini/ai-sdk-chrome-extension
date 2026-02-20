"use client";

import type { BlogAudio } from "@/lib/db";

interface VersionsListProps {
  versions: BlogAudio[];
  activeId: number | null;
  onSelect: (version: BlogAudio) => void;
  onDelete: (version: BlogAudio) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VOICE_NAMES: Record<string, string> = {
  JBFqnCBsd6RMkjVDRZzb: "George",
  "21m00Tcm4TlvDq8ikWAM": "Rachel",
  EXAVITQu4vr4xnSDxMaL: "Sarah",
  ErXwobaYiN019PkySvjV: "Antoni",
  pNInz6obpgDQGcFmaJgB: "Adam",
  yoZ06aMxZJJ28mfd3POQ: "Sam",
  onwK4e9ZLuTAKqWW03F9: "Daniel",
  XB0fDUnXU5powFXDhCwa: "Charlotte",
};

export function VersionsList({
  versions,
  activeId,
  onSelect,
  onDelete,
}: VersionsListProps) {
  if (versions.length === 0) {
    return (
      <div className="border border-border rounded-md px-4 py-8 text-center text-sm text-muted">
        No versions generated yet. Adjust settings and click Generate Audio.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Versions ({versions.length})
        </h3>
      </div>

      <div className="divide-y divide-border-light">
        {versions.map((v) => {
          const isActive = v.id === activeId;
          const voiceName = v.voice_id
            ? VOICE_NAMES[v.voice_id] || v.voice_id.substring(0, 8)
            : "Default";

          return (
            <div
              key={v.id}
              className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors group ${
                isActive ? "bg-card" : "hover:bg-card-hover"
              }`}
              onClick={() => onSelect(v)}
            >
              {/* Active indicator */}
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isActive ? "bg-accent" : "bg-border"
                }`}
              />

              {/* Label */}
              <span
                className={`text-sm font-mono flex-shrink-0 ${
                  isActive ? "text-foreground" : "text-muted"
                }`}
              >
                {v.label || `#${v.id}`}
              </span>

              {/* Metadata pills */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground bg-border-light rounded px-1.5 py-0.5 font-mono">
                  {voiceName}
                </span>
                {v.stability !== null && (
                  <span className="text-xs text-muted-foreground bg-border-light rounded px-1.5 py-0.5 font-mono">
                    S:{v.stability.toFixed(1)}
                  </span>
                )}
                {v.similarity_boost !== null && (
                  <span className="text-xs text-muted-foreground bg-border-light rounded px-1.5 py-0.5 font-mono">
                    SB:{v.similarity_boost.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Date */}
              <span className="text-xs text-muted-foreground font-mono tabular-nums flex-shrink-0">
                {formatDate(v.created_at)}
              </span>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(v);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                aria-label="Delete version"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
