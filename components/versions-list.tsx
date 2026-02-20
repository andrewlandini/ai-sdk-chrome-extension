"use client";

import type { BlogAudio } from "@/lib/db";

interface VersionsListProps {
  versions: BlogAudio[];
  activeId: number | null;
  onSelect: (version: BlogAudio) => void;
  onDelete: (version: BlogAudio) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VOICE_NAMES: Record<string, string> = {
  TX3LPaxmHKxFdv7VOQHJ: "Liam",
  nPczCjzI2devNBz1zQrb: "Brian",
  JBFqnCBsd6RMkjVDRZzb: "George",
  onwK4e9ZLuTAKqWW03F9: "Daniel",
  pFZP5JQG7iQjIQuC4Bku: "Lily",
  "21m00Tcm4TlvDq8ikWAM": "Rachel",
  EXAVITQu4vr4xnSDxMaL: "Sarah",
  Xb7hH8MSUJpSbSDYk0k2: "Alice",
  IKne3meq5aSn9XLyUdCD: "Charlie",
  cjVigY5qzO86Huf0OWal: "Eric",
  N2lVS1w4EtoT3dr4eOWO: "Callum",
  iP95p4xoKVk53GoZ742B: "Chris",
};

export function VersionsList({
  versions,
  activeId,
  onSelect,
  onDelete,
}: VersionsListProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-1 px-4 py-10 text-center">
        <p className="text-sm text-muted">No versions yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Adjust settings and click Generate Audio to create versions
        </p>
      </div>
    );
  }

  return (
    <section
      className="rounded-lg border border-border bg-surface-1 overflow-hidden"
      aria-labelledby="versions-heading"
    >
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 id="versions-heading" className="text-sm font-medium text-foreground">
          Versions
        </h2>
        <span className="text-xs text-muted font-mono tabular-nums">
          {versions.length}
        </span>
      </div>

      <div className="divide-y divide-border">
        {versions.map((v) => {
          const isActive = v.id === activeId;
          const voiceName = v.voice_id
            ? VOICE_NAMES[v.voice_id] || v.voice_id.substring(0, 6)
            : "Default";

          return (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors group focus-ring ${
                isActive ? "bg-surface-2" : "hover:bg-surface-2"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isActive ? "bg-accent" : "bg-border"
                }`}
                aria-hidden="true"
              />

              <span className={`text-sm font-mono flex-shrink-0 ${isActive ? "text-foreground" : "text-muted"}`}>
                {v.label || `#${v.id}`}
              </span>

              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                <span className="text-[11px] text-muted-foreground bg-surface-3 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
                  {voiceName}
                </span>
                {v.stability !== null && (
                  <span className="text-[11px] text-muted-foreground bg-surface-3 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
                    S:{v.stability.toFixed(1)}
                  </span>
                )}

              </div>

              <span className="text-[11px] text-muted-foreground font-mono tabular-nums flex-shrink-0 hidden sm:block">
                {formatDate(v.created_at)}
              </span>

              <a
                href={v.audio_url}
                download={`${(v.title || "audio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}--${voiceName.toLowerCase()}--${(v.label || `v${v.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.mp3`}
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground flex-shrink-0 focus-ring rounded"
                aria-label="Download version"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(v);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete(v);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive flex-shrink-0 focus-ring rounded"
                aria-label="Delete version"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
