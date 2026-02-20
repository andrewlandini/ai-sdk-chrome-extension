"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { BlogAudio } from "@/lib/db";

/* ── Column definitions ── */
type ColumnId = "title" | "slug" | "gens";

interface ColumnDef {
  id: ColumnId;
  label: string;
  width: string; // Tailwind width class
  align: "left" | "center" | "right";
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "title", label: "Title", width: "flex-1 min-w-0", align: "left" },
  { id: "slug", label: "Slug", width: "w-[140px] flex-shrink-0", align: "left" },
  { id: "gens", label: "Gens", width: "w-12 flex-shrink-0", align: "center" },
];

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
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
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
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const dragCol = useRef<number | null>(null);
  const dragOverCol = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => {
    dragCol.current = idx;
    setDraggingIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverCol.current = idx;
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback(() => {
    const from = dragCol.current;
    const to = dragOverCol.current;
    if (from !== null && to !== null && from !== to) {
      setColumns((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    dragCol.current = null;
    dragOverCol.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragCol.current = null;
    dragOverCol.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, BlogPostGroup>();
    for (const entry of entries) {
      const key = entry.url;
      if (!map.has(key)) {
        map.set(key, { url: key, title: entry.title || "Untitled", generations: [], latestDate: entry.created_at });
      }
      const group = map.get(key)!;
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

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) => g.title.toLowerCase().includes(q) || g.url.toLowerCase().includes(q)
    );
  }, [groups, search]);

  return (
    <div className="h-full flex flex-col">
      {/* Table header bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2 border-b border-border">
        <div className="relative flex-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter..."
            className="w-full h-7 pl-7 pr-3 rounded-md border border-border bg-surface-2 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors"
            aria-label="Filter posts"
          />
        </div>
        <span className="text-[10px] text-muted font-mono tabular-nums flex-shrink-0">{groups.length} posts</span>
      </div>

      {/* Column headers -- draggable */}
      <div className="flex-shrink-0 flex items-center h-7 px-3 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider font-medium select-none bg-surface-2/50">
        <span className="w-5 flex-shrink-0" />
        {columns.map((col, idx) => (
          <span
            key={col.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`${col.width} cursor-grab active:cursor-grabbing transition-all ${
              col.align === "right" ? "text-right pr-1" : col.align === "center" ? "text-center" : ""
            } ${draggingIdx === idx ? "opacity-40" : ""} ${
              dragOverIdx === idx && draggingIdx !== idx ? "border-l-2 border-l-accent" : ""
            }`}
          >
            {col.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto" role="list">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-muted-foreground">{entries.length === 0 ? "No posts yet" : "No results"}</p>
          </div>
        ) : (
          filtered.map((group) => {
            const isSelected = group.url === selectedUrl;
            const isExpanded = expandedUrl === group.url;
            const genCount = group.generations.length;

            return (
              <div key={group.url} role="listitem">
                {/* Post row -- single line */}
                <div
                  className={`flex items-center h-8 px-3 border-b border-border/60 cursor-pointer transition-colors group text-xs ${
                    isSelected
                      ? "bg-accent/8 border-l-2 border-l-accent"
                      : "hover:bg-surface-2 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => onSelect(group.url, group.title)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") onSelect(group.url, group.title); }}
                >
                  {/* Expand chevron */}
                  <span className="w-5 flex-shrink-0 flex items-center justify-center">
                    {genCount > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedUrl(isExpanded ? null : group.url);
                        }}
                        className="p-0.5 text-muted hover:text-foreground transition-colors focus-ring rounded"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-border/50" />
                    )}
                  </span>

                  {/* Dynamic columns */}
                  {columns.map((col) => {
                    switch (col.id) {
                      case "title":
                        return (
                          <span key={col.id} className={`${col.width} truncate ${isSelected ? "text-foreground font-medium" : "text-muted group-hover:text-foreground"} transition-colors`}>
                            {group.title}
                          </span>
                        );
                      case "slug":
                        return (
                          <span key={col.id} className={`${col.width} text-left text-[10px] text-muted-foreground font-mono truncate`} title={group.url}>
                            {slugFromUrl(group.url)}
                          </span>
                        );
                      case "gens":
                        return (
                          <span key={col.id} className={`${col.width} text-center font-mono tabular-nums ${genCount > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                            {genCount}
                          </span>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>

                {/* Expanded sub-rows */}
                {isExpanded && genCount > 0 && (
                  <div>
                    {group.generations.map((gen) => {
                      const voiceName = gen.voice_id ? VOICE_NAMES[gen.voice_id] || "?" : "--";
                      const isActive = gen.id === activeId;

                      return (
                        <div
                          key={gen.id}
                          className={`flex items-center h-7 px-3 pl-8 border-b border-border/30 cursor-pointer group/gen transition-colors text-[11px] ${
                            isActive ? "bg-accent/10 text-foreground" : "bg-surface-2/30 text-muted hover:bg-surface-2 hover:text-foreground"
                          }`}
                          onClick={() => onPlay(gen)}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mr-2 ${isActive ? "bg-success" : "bg-border"}`} />
                          <span className="flex-1 min-w-0 truncate">{gen.label || "No label"}</span>
                          <span className="w-14 flex-shrink-0 text-center font-mono text-[10px] text-muted-foreground">{voiceName}</span>
                          <span className="w-10 flex-shrink-0 text-center font-mono text-[10px] text-muted-foreground tabular-nums">
                            {gen.stability !== null ? gen.stability.toFixed(1) : "--"}
                          </span>
                          <span className="w-10 flex-shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                            {formatRelative(gen.created_at)}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
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
