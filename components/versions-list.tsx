"use client";

import type { BlogAudio } from "@/lib/db";
import { formatRelativeShort } from "@/lib/timezone";

interface VersionsListProps {
  versions: BlogAudio[];
  activeId: number | null;
  isPlaying?: boolean;
  onSelect: (version: BlogAudio) => void;
  onDelete: (version: BlogAudio) => void;
  onEdit?: (version: BlogAudio) => void;
  onTogglePlay?: (version: BlogAudio) => void;
}

const VISIBLE_ROWS = 5;

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

// Map full vibe description values to short display names
const VIBE_PRESETS: { keyword: string; name: string }[] = [
  { keyword: "frustrated voice actor", name: "Unhinged" },
  { keyword: "Confident and genuinely excited", name: "Confident" },
  { keyword: "Calm, measured narrator", name: "Calm" },
  { keyword: "Friendly podcast host", name: "Podcast" },
  { keyword: "Professional news anchor", name: "Newscast" },
  { keyword: "Engaging storyteller", name: "Storyteller" },
  { keyword: "Minimal, understated", name: "Minimal" },
];

function getVibeLabel(summary: string | null): string {
  if (!summary) return "--";
  for (const preset of VIBE_PRESETS) {
    if (summary.includes(preset.keyword)) return preset.name;
  }
  // Check if summary has style agent markers (audio tags like <break>)
  if (summary.includes("<break") || summary.includes("<prosody") || summary.includes("<emphasis")) return "Styled";
  return "--";
}

export function VersionsList({
  versions,
  activeId,
  isPlaying = false,
  onSelect,
  onDelete,
  onEdit,
  onTogglePlay,
}: VersionsListProps) {
  // Pad to always show VISIBLE_ROWS
  const emptyCount = Math.max(0, VISIBLE_ROWS - versions.length);

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Column headers -- matching PostsList style */}
      <div className="flex items-center h-7 px-3 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-medium select-none bg-surface-2/50">
        <span className="w-5 flex-shrink-0" />
        <span className="flex-1 min-w-0">Filename</span>
        <span className="w-16 flex-shrink-0 text-center">Voice</span>
        <span className="w-24 flex-shrink-0" />
      </div>

      {/* Data rows */}
      <div role="list">
        {versions.map((v) => {
          const isActive = v.id === activeId;
          const voiceName = v.voice_id
            ? VOICE_NAMES[v.voice_id] || v.voice_id.substring(0, 6)
            : "Default";

          return (
            <div
              key={v.id}
              onClick={() => onSelect(v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") onSelect(v); }}
              className={`flex items-center h-8 px-3 border-b border-border/60 cursor-pointer transition-colors group text-xs ${
                isActive
                  ? "bg-accent/8 border-l-2 border-l-accent"
                  : "hover:bg-surface-2 border-l-2 border-l-transparent"
              }`}
            >
              {/* Status dot */}
              <span className="w-5 flex-shrink-0 flex items-center justify-center">
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-accent" : "bg-border/50"}`} />
              </span>

              {/* Label */}
              <span className={`flex-1 min-w-0 truncate font-mono ${isActive ? "text-foreground font-medium" : "text-muted group-hover:text-foreground"} transition-colors`}>
                {v.label || `#${v.id}`}
              </span>

              {/* Voice */}
              <span className="w-16 flex-shrink-0 text-center text-[10px] text-muted-foreground font-mono truncate">
                {voiceName}
              </span>

              {/* Actions */}
              <span className="w-24 flex-shrink-0 flex items-center justify-end gap-0.5">
                {/* Play / Pause */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTogglePlay) onTogglePlay(v);
                    else onSelect(v);
                  }}
                  className={`p-1 transition-all focus-ring rounded ${
                    isActive ? "text-accent" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={isActive && isPlaying ? "Pause" : "Play"}
                >
                  {isActive && isPlaying ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </button>
                {/* Edit */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) onEdit(v);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all focus-ring rounded"
                  aria-label="Edit version script"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {/* Download */}
                <a
                  href={v.audio_url}
                  download={`${v.label || `v${v.id}`}.mp3`}
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all focus-ring rounded"
                  aria-label="Download version"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${v.label || `version #${v.id}`}"? This cannot be undone.`)) {
                      onDelete(v);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all focus-ring rounded"
                  aria-label="Delete version"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
          );
        })}

        {/* Empty placeholder rows */}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center h-8 px-3 border-b border-border/30 text-xs border-l-2 border-l-transparent"
          >
            <span className="w-5 flex-shrink-0 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-border/20" />
            </span>
            <span className="flex-1 min-w-0 text-muted-foreground/20 font-mono">--</span>
            <span className="w-16 flex-shrink-0 text-center text-[10px] text-muted-foreground/20 font-mono">--</span>
            <span className="w-24 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
