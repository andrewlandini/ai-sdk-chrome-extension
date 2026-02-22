"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { BlogAudio } from "@/lib/db";

/* ── Column definitions ── */
type ColumnId = "title" | "date" | "gens";
type SortKey = "title" | "date";
type SortDir = "asc" | "desc";

interface ColumnDef {
  id: ColumnId;
  label: string;
  width: string; // Tailwind width class
  align: "left" | "center" | "right";
  sortable?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "date", label: "Date", width: "w-20 flex-shrink-0", align: "left", sortable: true },
  { id: "title", label: "Title", width: "flex-1 min-w-0", align: "left", sortable: true },
  { id: "gens", label: "Gens", width: "w-12 flex-shrink-0", align: "center" },
];



interface BlogPostGroup {
  url: string;
  title: string;
  publishedDate: string | null;
  generations: BlogAudio[];
  latestDate: string;
  hasScript: boolean;
}

interface PostsListProps {
  entries: BlogAudio[];
  selectedUrl: string;
  activeId: number | null;
  onSelect: (url: string, title: string) => void;
  onPlay: (entry: BlogAudio) => void;
  onDelete: (entry: BlogAudio) => void;
  onPreview?: (url: string, title: string) => void;
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

export function PostsList({ entries, selectedUrl, activeId, onSelect, onPlay, onDelete, onPreview }: PostsListProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
      const entryWithScript = entry as BlogAudio & { cached_script?: string | null; published_date?: string | null };
      if (!map.has(key)) {
        map.set(key, { url: key, title: entry.title || "Untitled", publishedDate: entryWithScript.published_date ?? null, generations: [], latestDate: entry.created_at, hasScript: !!entryWithScript.cached_script });
      }
      const group = map.get(key)!;
      if (entry.id !== -1) {
        group.generations.push(entry);
      }
      if (entryWithScript.cached_script) {
        group.hasScript = true;
      }
      if (entry.title && new Date(entry.created_at) > new Date(group.latestDate)) {
        group.title = entry.title;
        group.latestDate = entry.created_at;
      }
    }
    return Array.from(map.values());
  }, [entries]);

  const filtered = useMemo(() => {
    const base = !search.trim()
      ? groups
      : groups.filter((g) => {
          const q = search.toLowerCase();
          return g.title.toLowerCase().includes(q) || g.url.toLowerCase().includes(q);
        });

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "title") {
        const cmp = (a.title || "").localeCompare(b.title || "");
        return sortDir === "asc" ? cmp : -cmp;
      }
      // Sort by date
      const da = a.publishedDate || "";
      const db = b.publishedDate || "";
      const cmp = da.localeCompare(db);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [groups, search, sortKey, sortDir]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }, [sortKey]);

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
            onClick={col.sortable ? () => handleSort(col.id as SortKey) : undefined}
            className={`${col.width} ${col.sortable ? "cursor-pointer hover:text-foreground" : "cursor-grab"} active:cursor-grabbing transition-all flex items-center gap-0.5 ${
              col.align === "right" ? "text-right pr-1 justify-end" : col.align === "center" ? "text-center justify-center" : ""
            } ${draggingIdx === idx ? "opacity-40" : ""} ${
              dragOverIdx === idx && draggingIdx !== idx ? "border-l-2 border-l-accent" : ""
            }`}
          >
            {col.label}
            {col.sortable && sortKey === col.id && (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="flex-shrink-0" aria-hidden="true">
                {sortDir === "asc" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
              </svg>
            )}
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
                  {/* Status dot */}
                  <span className="w-5 flex-shrink-0 flex items-center justify-center">
                    <span className={`w-2 h-2 rounded-full ${genCount > 0 ? "bg-accent/60" : group.hasScript ? "bg-success/60" : "bg-border/50"}`} />
                  </span>

                  {/* Dynamic columns */}
                  {columns.map((col) => {
                    switch (col.id) {
                      case "date":
                        return (
                          <span key={col.id} className={`${col.width} text-[10px] font-mono tabular-nums text-muted-foreground truncate`}>
                            {group.publishedDate
                              ? new Date(group.publishedDate).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3/$1/$2")
                              : ""}
                          </span>
                        );

                      case "title":
                        return (
                          <span key={col.id} className={`${col.width} truncate ${isSelected ? "text-foreground font-medium" : "text-muted group-hover:text-foreground"} transition-colors`}>
                            {group.title}
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
                  {/* Preview button */}
                  {onPreview && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPreview(group.url, group.title); }}
                      aria-label="Preview original blog text"
                      className="w-6 flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-foreground"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                </div>


              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
