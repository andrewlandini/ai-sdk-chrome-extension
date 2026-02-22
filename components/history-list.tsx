"use client";

import type { BlogAudio } from "@/lib/db";
import { formatDate } from "@/lib/timezone";

interface HistoryListProps {
  entries: BlogAudio[];
  activeId: number | null;
  onSelect: (entry: BlogAudio) => void;
}

export function HistoryList({ entries, activeId, onSelect }: HistoryListProps) {
  return (
    <section
      className="rounded-lg border border-border bg-surface-1 overflow-hidden"
      aria-labelledby="history-heading"
    >
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 id="history-heading" className="text-sm font-medium text-foreground">
          History
        </h2>
        {entries.length > 0 && (
          <span className="text-xs text-muted font-mono tabular-nums">
            {entries.length}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted">No audio generated yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Results will appear here
          </p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
          {entries.map((entry) => {
            const isActive = entry.id === activeId;
            return (
              <button
                key={entry.id}
                onClick={() => onSelect(entry)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors focus-ring ${
                  isActive ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span
                  className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-success" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm text-foreground truncate flex-1 min-w-0">
                  {entry.title || "Untitled"}
                </span>
                <span className="text-xs text-muted font-mono tabular-nums flex-shrink-0">
                  {formatDate(entry.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
