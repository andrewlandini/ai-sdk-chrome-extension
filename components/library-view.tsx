"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import { WaveformPlayer } from "@/components/waveform-player";
import type { BlogAudio } from "@/lib/db";
import { formatDateFull, formatTime, formatRelative } from "@/lib/timezone";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SortField = "title" | "count" | "latest";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100] as const;

interface BlogPostGroup {
  url: string;
  title: string;
  generations: BlogAudio[];
  latestDate: string;
}

interface LibraryViewProps {
  entries: BlogAudio[];
  activeId: number | null;
  onPlay: (entry: BlogAudio) => void;
  onOpenInGenerator: (entry: BlogAudio) => void;
  onDelete: (entry: BlogAudio) => void;
  mutateHistory: () => void;
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

export function LibraryView({
  entries,
  activeId,
  onPlay,
  onOpenInGenerator,
  onDelete,
}: LibraryViewProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("latest");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<BlogAudio | null>(null);

  const { data: voiceData } = useSWR<{
    voiceMeta: Record<string, { name: string; desc: string; gender: string }>;
  }>("/api/voices", fetcher);
  const VOICE_NAMES: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(voiceData?.voiceMeta ?? {})) {
      map[id] = meta.name;
    }
    return map;
  }, [voiceData]);

  // Group entries by blog post URL
  const groups = useMemo(() => {
    const map = new Map<string, BlogPostGroup>();
    for (const entry of entries) {
      const key = entry.url;
      if (!map.has(key)) {
        map.set(key, {
          url: key,
          title: entry.title || "Untitled",
          generations: [],
          latestDate: entry.created_at,
        });
      }
      const group = map.get(key)!;
      group.generations.push(entry);
      // Use the most recent title
      if (entry.title && new Date(entry.created_at) > new Date(group.latestDate)) {
        group.title = entry.title;
        group.latestDate = entry.created_at;
      }
    }
    return Array.from(map.values());
  }, [entries]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.url.toLowerCase().includes(q) ||
        g.generations.some(
          (gen) =>
            gen.label?.toLowerCase().includes(q) ||
            (gen.voice_id && VOICE_NAMES[gen.voice_id]?.toLowerCase().includes(q))
        )
    );
  }, [groups, search]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortField === "title") return dir * a.title.localeCompare(b.title);
      if (sortField === "count") return dir * (a.generations.length - b.generations.length);
      if (sortField === "latest")
        return dir * (new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime());
      return 0;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  // Paginate blog posts (not individual generations)
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortField]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`ml-1 inline-block transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  };

  const totalGenerations = entries.length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Library</h1>
          <p className="text-xs text-muted mt-0.5">
            {filtered.length === groups.length
              ? `${groups.length} blog posts, ${totalGenerations} total generations`
              : `${filtered.length} of ${groups.length} posts matching`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search posts, voices, labels..."
              className="h-8 w-72 pl-8 pr-3 rounded-md border border-border bg-surface-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent transition-colors"
              aria-label="Search library"
            />
          </div>
        </div>
      </div>

      {/* Table + Detail split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table */}
        <div className={`flex-1 flex flex-col overflow-hidden ${detailEntry ? "border-r border-border" : ""}`}>
          {/* Column headers */}
          <div className="flex-shrink-0 border-b border-border bg-surface-1">
            <div className="grid grid-cols-[32px_1fr_120px_100px_140px] px-6 py-2 text-[11px] font-medium text-muted uppercase tracking-wider">
              <span />
              <button className="text-left focus-ring rounded" onClick={() => toggleSort("title")}>
                Blog Post <SortIcon field="title" />
              </button>
              <button className="text-left focus-ring rounded" onClick={() => toggleSort("count")}>
                Generations <SortIcon field="count" />
              </button>
              <span className="text-left">Voices</span>
              <button className="text-left focus-ring rounded" onClick={() => toggleSort("latest")}>
                Last Generated <SortIcon field="latest" />
              </button>
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto">
            {paged.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <p className="text-sm text-muted">
                    {entries.length === 0 ? "No generations yet" : "No results match your search"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entries.length === 0
                      ? "Go to Generator to create your first audio"
                      : "Try adjusting your search"}
                  </p>
                </div>
              </div>
            ) : (
              paged.map((group) => {
                const isExpanded = expandedUrl === group.url;
                const uniqueVoices = [...new Set(group.generations.map((g) => g.voice_id).filter(Boolean))];

                return (
                  <div key={group.url}>
                    {/* Blog post row */}
                    <div
                      className={`grid grid-cols-[32px_1fr_120px_100px_140px] px-6 py-3 items-center border-b border-border cursor-pointer table-row-hover group ${
                        isExpanded ? "bg-surface-2" : ""
                      }`}
                      onClick={() => setExpandedUrl(isExpanded ? null : group.url)}
                    >
                      {/* Expand chevron */}
                      <span className="flex items-center justify-center">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>

                      {/* Title + URL slug */}
                      <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                        <span className="text-sm text-foreground truncate font-medium">
                          {group.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate">
                          {slugFromUrl(group.url)}
                        </span>
                      </div>

                      {/* Generation count */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground font-mono tabular-nums">
                          {group.generations.length}
                        </span>
                        <span className="text-[10px] text-muted">
                          {group.generations.length === 1 ? "version" : "versions"}
                        </span>
                      </div>

                      {/* Unique voices used */}
                      <div className="flex flex-wrap gap-1">
                        {uniqueVoices.slice(0, 3).map((vid) => (
                          <span
                            key={vid}
                            className="text-[10px] text-muted bg-surface-3 rounded px-1.5 py-0.5 font-mono"
                          >
                            {VOICE_NAMES[vid!] || "?"}
                          </span>
                        ))}
                        {uniqueVoices.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{uniqueVoices.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Last generated */}
                      <span className="text-xs text-muted font-mono tabular-nums">
                        {formatRelative(group.latestDate)}
                      </span>
                    </div>

                    {/* Expanded generation rows */}
                    {isExpanded && (
                      <div className="bg-surface-1">
                        {/* Sub-header */}
                        <div className="grid grid-cols-[32px_1fr_100px_80px_120px_100px] px-6 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border bg-surface-2/50">
                          <span />
                          <span>Label</span>
                          <span>Voice</span>
                          <span>Stability</span>
                          <span>Created</span>
                          <span className="text-right">Actions</span>
                        </div>

                        {group.generations.map((gen) => {
                          const voiceName = gen.voice_id
                            ? VOICE_NAMES[gen.voice_id] || gen.voice_id.substring(0, 6)
                            : "--";
                          const isPlaying = gen.id === activeId;

                          return (
                            <div
                              key={gen.id}
                              className={`grid grid-cols-[32px_1fr_100px_80px_120px_100px] px-6 py-2 items-center border-b border-border/50 cursor-pointer group/gen ${
                                isPlaying ? "bg-accent/5" : "hover:bg-surface-2/50"
                              }`}
                              onClick={() => setDetailEntry(gen)}
                            >
                              {/* Indent spacer + playing indicator */}
                              <span className="flex items-center justify-center">
                                {isPlaying ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-success" aria-label="Now playing" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-border" aria-hidden="true" />
                                )}
                              </span>

                              {/* Label */}
                              <div className="flex items-center gap-2 min-w-0 pr-4">
                                <span className="text-xs text-foreground truncate">
                                  {gen.label || "No label"}
                                </span>
                              </div>

                              {/* Voice */}
                              <span className="text-xs text-muted font-mono">{voiceName}</span>

                              {/* Stability */}
                              <span className="text-xs text-muted font-mono tabular-nums">
                                {gen.stability !== null ? gen.stability.toFixed(2) : "--"}
                              </span>

                              {/* Created */}
                              <div className="flex flex-col">
                                <span className="text-[11px] text-muted font-mono tabular-nums">
                                  {formatDateFull(gen.created_at)}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                                  {formatTime(gen.created_at)}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onPlay(gen);
                                  }}
                                  className="opacity-0 group-hover/gen:opacity-100 p-1.5 text-muted hover:text-foreground transition-all focus-ring rounded"
                                  aria-label="Play"
                                  title="Play"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M6 4v16l14-8z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenInGenerator(gen);
                                  }}
                                  className="opacity-0 group-hover/gen:opacity-100 p-1.5 text-muted hover:text-foreground transition-all focus-ring rounded"
                                  aria-label="Open in Generator"
                                  title="Open in Generator"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </button>
                                <a
                                  href={gen.audio_url}
                                  download={`${(gen.title || "audio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}--${voiceName.toLowerCase()}--${(gen.label || `v${gen.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.mp3`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover/gen:opacity-100 p-1.5 text-muted hover:text-foreground transition-all focus-ring rounded"
                                  aria-label="Download"
                                  title="Download"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
                                  className="opacity-0 group-hover/gen:opacity-100 p-1.5 text-muted hover:text-destructive transition-all focus-ring rounded"
                                  aria-label="Delete"
                                  title="Delete"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

          {/* Pagination footer */}
          {sorted.length > 0 && (
            <div className="flex-shrink-0 border-t border-border px-6 py-2.5 flex items-center justify-between bg-surface-1">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  Showing {(safePage - 1) * pageSize + 1}--{Math.min(safePage * pageSize, sorted.length)} of {sorted.length} posts
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 pl-2 pr-6 rounded border border-border bg-surface-2 text-[11px] text-muted focus:outline-none focus:border-accent appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 6px center",
                  }}
                  aria-label="Page size"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-7 px-2 rounded border border-border text-xs text-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
                >
                  Prev
                </button>
                <span className="text-xs text-muted font-mono tabular-nums px-2">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-7 px-2 rounded border border-border text-xs text-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {detailEntry && (
          <div className="w-[420px] flex-shrink-0 overflow-y-auto bg-surface-1 animate-fade-in">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground truncate pr-2">
                  {detailEntry.label || detailEntry.title || "Untitled"}
                </h3>
                <button
                  onClick={() => setDetailEntry(null)}
                  className="p-1 text-muted hover:text-foreground transition-colors rounded focus-ring flex-shrink-0"
                  aria-label="Close detail"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <WaveformPlayer
                key={detailEntry.id}
                audioUrl={detailEntry.audio_url}
                title={detailEntry.title || "Untitled"}
                summary={detailEntry.summary || ""}
                url={detailEntry.url}
                autoplay={false}
              />

              {/* Meta */}
              <div className="flex flex-col gap-0 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">ID</span>
                  <span className="text-foreground font-mono">{detailEntry.id}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Voice</span>
                  <span className="text-foreground font-mono">
                    {detailEntry.voice_id
                      ? VOICE_NAMES[detailEntry.voice_id] || detailEntry.voice_id.substring(0, 8)
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Stability</span>
                  <span className="text-foreground font-mono tabular-nums">
                    {detailEntry.stability !== null ? detailEntry.stability.toFixed(2) : "--"}
                  </span>
                </div>
                {detailEntry.label && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="text-muted">Label</span>
                    <span className="text-foreground font-mono">{detailEntry.label}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Blog Post</span>
                  <a
                    href={detailEntry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-mono truncate max-w-[200px]"
                  >
                    {slugFromUrl(detailEntry.url)}
                  </a>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted">Created</span>
                  <span className="text-foreground font-mono tabular-nums">
                    {formatDateFull(detailEntry.created_at)} {formatTime(detailEntry.created_at)}
                  </span>
                </div>
              </div>

              {/* Script preview */}
              {detailEntry.summary && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Script Preview</span>
                  <div className="text-xs text-muted font-mono leading-relaxed bg-surface-2 rounded-md p-3 max-h-[200px] overflow-y-auto">
                    {detailEntry.summary.substring(0, 500)}
                    {detailEntry.summary.length > 500 && "..."}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
