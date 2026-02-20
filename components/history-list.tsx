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
  });
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch {
    return url;
  }
}

export function HistoryList({ entries, activeId, onSelect }: HistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted">No audio generated yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Paste a blog URL above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {/* Table Header */}
      <div className="grid grid-cols-[1fr_200px_80px] gap-4 px-4 py-2.5 text-xs text-muted-foreground uppercase tracking-wider font-medium bg-card">
        <span>Title</span>
        <span className="hidden sm:block">Source</span>
        <span className="text-right">Date</span>
      </div>

      {/* Rows */}
      {entries.map((entry) => {
        const isActive = entry.id === activeId;
        return (
          <button
            key={entry.id}
            onClick={() => onSelect(entry)}
            className={`grid grid-cols-[1fr_200px_80px] gap-4 items-center px-4 py-3 text-left transition-colors w-full ${
              isActive
                ? "bg-card-hover"
                : "hover:bg-card-hover"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Status dot */}
              <div
                className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                  isActive ? "bg-success" : "bg-border"
                }`}
              />
              <span className="text-sm text-foreground truncate">
                {entry.title || "Untitled"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono truncate hidden sm:block">
              {truncateUrl(entry.url)}
            </span>
            <span className="text-xs text-muted-foreground text-right">
              {formatDate(entry.created_at)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
