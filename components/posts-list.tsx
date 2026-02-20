"use client";

import { useState, useMemo } from "react";
import type { BlogAudio } from "@/lib/db";

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

interface BlogPostGroup {
  url: string;
  title: string;
  generations: BlogAudio[];
  latestDate: string;
}

interface PostsListProps {
  entries: BlogAudio[];
  selectedUrl: string;
  activeId: number | null;
  onSelect: (url: string, title: string) => void;
  onPlay: (entry: BlogAudio) => void;
  onDelete: (entry: BlogAudio) => void;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last || url;
  } catch {
    return url;
  }
}

export function PostsList({ entries, selectedUrl, activeId, onSelect, onPlay, onDelete }: PostsListProps) {
  const [search, setSearch] = useState("");
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  // Group by URL
  const groups = useMemo(() => {
    const map = new Map<string, BlogPostGroup>();
    for (const entry of entries) {
      const key = entry.url;
      if (!map.has(key)) {
        map.set(key, { url: key, title: entry.title || "Untitled", generations: [], latestDate: entry.created_at });
      }
      const group = map.get(key)!;
      // id === -1 means cached post with no audio yet — don't add as generation
      if (entry.id !== -1) {
        group.generations.push(entry);
      }
      if (entry.title && new Date(entry.created_at) > new Date(group.latestDate)) {
        group.title = entry.title;
        group.latestDate = entry.created_at;
      }
    }
    return Array.from(map.values());
  }, [entries]);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) => g.title.toLowerCase().includes(q) || g.url.toLowerCase().includes(q)
    );
  }, [groups, search]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-foreground uppercase tracking-wider">Blog Posts</h2>
          <span className="text-[10px] text-muted font-mono tabular-nums">{groups.length}</span>
        </div>
        <div className="relative">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter posts..."
            className="w-full h-7 pl-8 pr-3 rounded-md border border-border bg-surface-2 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors"
            aria-label="Filter posts"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-muted">
              {entries.length === 0 ? "No posts yet" : "No results"}
            </p>
          </div>
        ) : (
          filtered.map((group) => {
            const isSelected = group.url === selectedUrl;
            const isExpanded = expandedUrl === group.url;
            const genCount = group.generations.length;

            return (
              <div key={group.url}>
                {/* Post row */}
                <div
                  className={`flex flex-col px-3 py-2.5 border-b border-border cursor-pointer transition-colors group ${
                    isSelected ? "bg-accent/8 border-l-2 border-l-accent" : "hover:bg-surface-2 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => onSelect(group.url, group.title)}
                >
                  <div className="flex items-start gap-2">
                    {/* Expand toggle */}
                    {genCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedUrl(isExpanded ? null : group.url);
                        }}
                        className="flex-shrink-0 mt-0.5 p-0.5 text-muted hover:text-foreground transition-colors focus-ring rounded"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    )}
                    {genCount === 0 && <span className="w-[18px] flex-shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${isSelected ? "text-foreground" : "text-muted group-hover:text-foreground"} transition-colors`}>
                        {group.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {slugFromUrl(group.url)}
                        </span>
                        {genCount > 0 && (
                          <span className="text-[10px] text-muted font-mono tabular-nums flex-shrink-0">
                            {genCount} {genCount === 1 ? "gen" : "gens"}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelative(group.latestDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded generations */}
                {isExpanded && genCount > 0 && (
                  <div className="bg-surface-2/50">
                    {group.generations.map((gen) => {
                      const voiceName = gen.voice_id ? VOICE_NAMES[gen.voice_id] || "?" : "--";
                      const isActive = gen.id === activeId;

                      return (
                        <div
                          key={gen.id}
                          className={`flex items-center gap-2 px-3 py-1.5 pl-8 border-b border-border/50 cursor-pointer group/gen transition-colors ${
                            isActive ? "bg-accent/10" : "hover:bg-surface-2"
                          }`}
                          onClick={() => onPlay(gen)}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-success" : "bg-border"}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-foreground truncate block">
                              {gen.label || "No label"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {voiceName} / {gen.stability !== null ? gen.stability.toFixed(2) : "--"}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {/* Download */}
                            <a
                              href={gen.audio_url}
                              download={`${(gen.title || "audio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}--${voiceName.toLowerCase()}--${(gen.label || `v${gen.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.mp3`}
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover/gen:opacity-100 p-1 text-muted hover:text-foreground transition-all focus-ring rounded"
                              aria-label="Download"
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
                                if (window.confirm(`Delete "${gen.label || gen.title || "this generation"}"? This cannot be undone.`)) {
                                  onDelete(gen);
                                }
                              }}
                              className="opacity-0 group-hover/gen:opacity-100 p-1 text-muted hover:text-destructive transition-all focus-ring rounded"
                              aria-label="Delete"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
