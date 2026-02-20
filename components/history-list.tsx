"use client";

import type { BlogAudio } from "@/lib/db";

interface HistoryListProps {
  entries: BlogAudio[];
  activeId: number | null;
  onSelect: (entry: BlogAudio) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateUrl(url: string, maxLen = 50): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    return display.length > maxLen
      ? display.substring(0, maxLen) + "..."
      : display;
  } catch {
    return url.length > maxLen ? url.substring(0, maxLen) + "..." : url;
  }
}

export function HistoryList({ entries, activeId, onSelect }: HistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mb-3 text-muted-foreground"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <p className="text-sm">No audio generated yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Paste a blog URL above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {entries.map((entry) => {
        const isActive = entry.id === activeId;
        return (
          <button
            key={entry.id}
            onClick={() => onSelect(entry)}
            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors w-full ${
              isActive
                ? "bg-card border border-card-border"
                : "hover:bg-card/50"
            }`}
          >
            {/* Play indicator */}
            <div
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "bg-card-border text-muted"
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="ml-0.5"
              >
                <path d="M6 4v16l14-8z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground truncate">
                {entry.title || "Untitled"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {truncateUrl(entry.url)}
              </span>
            </div>

            {/* Date */}
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDate(entry.created_at)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
