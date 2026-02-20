"use client";

import { useState, useMemo, useCallback } from "react";
import { WaveformPlayer } from "@/components/waveform-player";
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

type SortField = "created_at" | "title" | "voice";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100] as const;

interface LibraryViewProps {
  entries: BlogAudio[];
  activeId: number | null;
  onPlay: (entry: BlogAudio) => void;
  onOpenInGenerator: (entry: BlogAudio) => void;
  onDelete: (entry: BlogAudio) => void;
  mutateHistory: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateHost(url: string): string {
  try {
    return new URL(url).hostname;
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
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [voiceFilter, setVoiceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Unique voices for filter
  const uniqueVoices = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.voice_id) set.add(e.voice_id);
    });
    return Array.from(set);
  }, [entries]);

  // Filter + Search
  const filtered = useMemo(() => {
    let result = entries;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.url.toLowerCase().includes(q) ||
          e.label?.toLowerCase().includes(q) ||
          (e.voice_id && VOICE_NAMES[e.voice_id]?.toLowerCase().includes(q))
      );
    }

    if (voiceFilter !== "all") {
      result = result.filter((e) => e.voice_id === voiceFilter);
    }

    return result;
  }, [entries, search, voiceFilter]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortField === "created_at") {
        return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      if (sortField === "title") {
        return dir * (a.title || "").localeCompare(b.title || "");
      }
      if (sortField === "voice") {
        const va = a.voice_id ? VOICE_NAMES[a.voice_id] || a.voice_id : "";
        const vb = b.voice_id ? VOICE_NAMES[b.voice_id] || b.voice_id : "";
        return dir * va.localeCompare(vb);
      }
      return 0;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  // Paginate
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

  const activeEntry = expandedId ? entries.find((e) => e.id === expandedId) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Library</h1>
          <p className="text-xs text-muted mt-0.5">
            {filtered.length === entries.length
              ? `${entries.length} total generations`
              : `${filtered.length} of ${entries.length} generations`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Voice filter */}
          <select
            value={voiceFilter}
            onChange={(e) => {
              setVoiceFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 pl-2.5 pr-7 rounded-md border border-border bg-surface-2 text-xs text-foreground focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
            aria-label="Filter by voice"
          >
            <option value="all">All voices</option>
            {uniqueVoices.map((vid) => (
              <option key={vid} value={vid}>
                {VOICE_NAMES[vid] || vid.substring(0, 8)}
              </option>
            ))}
          </select>

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
              placeholder="Search titles, URLs, labels..."
              className="h-8 w-64 pl-8 pr-3 rounded-md border border-border bg-surface-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent transition-colors"
              aria-label="Search library"
            />
          </div>
        </div>
      </div>

      {/* ── Table + Detail split ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table */}
        <div className={`flex-1 flex flex-col overflow-hidden ${activeEntry ? "border-r border-border" : ""}`}>
          {/* Table header */}
          <div className="flex-shrink-0 border-b border-border bg-surface-1">
            <div className="grid grid-cols-[1fr_140px_100px_80px_100px_80px] px-6 py-2 text-[11px] font-medium text-muted uppercase tracking-wider">
              <button className="text-left focus-ring rounded" onClick={() => toggleSort("title")}>
                Title <SortIcon field="title" />
              </button>
              <span className="text-left">Source</span>
              <button className="text-left focus-ring rounded" onClick={() => toggleSort("voice")}>
                Voice <SortIcon field="voice" />
              </button>
              <span className="text-left">Stability</span>
              <button className="text-left focus-ring rounded" onClick={() => toggleSort("created_at")}>
                Created <SortIcon field="created_at" />
              </button>
              <span className="text-right">Actions</span>
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto">
            {paged.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <p className="text-sm text-muted">
                    {entries.length === 0 ? "No generations yet" : "No results match your filters"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entries.length === 0
                      ? "Go to Generator to create your first audio"
                      : "Try adjusting your search or filters"}
                  </p>
                </div>
              </div>
            ) : (
              paged.map((entry) => {
                const isActive = entry.id === activeId;
                const isExpanded = entry.id === expandedId;
                const voiceName = entry.voice_id
                  ? VOICE_NAMES[entry.voice_id] || entry.voice_id.substring(0, 6)
                  : "--";

                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[1fr_140px_100px_80px_100px_80px] px-6 py-2.5 items-center text-sm border-b border-border cursor-pointer table-row-hover group ${
                      isExpanded ? "bg-surface-2" : isActive ? "bg-accent/5" : ""
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    {/* Title + label */}
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isActive ? "bg-success" : "bg-border"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-foreground truncate text-sm">
                        {entry.title || "Untitled"}
                      </span>
                      {entry.label && (
                        <span className="text-[10px] text-muted bg-surface-3 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
                          {entry.label}
                        </span>
                      )}
                    </div>

                    {/* Source */}
                    <span className="text-xs text-muted font-mono truncate">
                      {truncateHost(entry.url)}
                    </span>

                    {/* Voice */}
                    <span className="text-xs text-muted font-mono">{voiceName}</span>

                    {/* Stability */}
                    <span className="text-xs text-muted font-mono tabular-nums">
                      {entry.stability !== null ? entry.stability.toFixed(2) : "--"}
                    </span>

                    {/* Date */}
                    <div className="flex flex-col">
                      <span className="text-xs text-muted font-mono tabular-nums">
                        {formatDate(entry.created_at)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {formatTime(entry.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlay(entry);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-foreground transition-all focus-ring rounded"
                        aria-label="Play"
                        title="Play"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M6 4v16l14-8z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenInGenerator(entry);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-foreground transition-all focus-ring rounded"
                        aria-label="Open in Generator"
                        title="Open in Generator"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </button>
                      <a
                        href={entry.audio_url}
                        download={`${(entry.title || "audio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}--${voiceName.toLowerCase()}--${(entry.label || `v${entry.id}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.mp3`}
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-foreground transition-all focus-ring rounded"
                        aria-label="Download"
                        title="Download"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(entry);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-destructive transition-all focus-ring rounded"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
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
                  Showing {(safePage - 1) * pageSize + 1}--{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
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
        {activeEntry && (
          <div className="w-[420px] flex-shrink-0 overflow-y-auto bg-surface-1 animate-fade-in">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Detail</h3>
                <button
                  onClick={() => setExpandedId(null)}
                  className="p-1 text-muted hover:text-foreground transition-colors rounded focus-ring"
                  aria-label="Close detail"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <WaveformPlayer
                key={activeEntry.id}
                audioUrl={activeEntry.audio_url}
                title={activeEntry.title || "Untitled"}
                summary={activeEntry.summary || ""}
                url={activeEntry.url}
                autoplay={false}
              />

              {/* Meta */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">ID</span>
                  <span className="text-foreground font-mono">{activeEntry.id}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Voice</span>
                  <span className="text-foreground font-mono">
                    {activeEntry.voice_id
                      ? VOICE_NAMES[activeEntry.voice_id] || activeEntry.voice_id.substring(0, 8)
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Stability</span>
                  <span className="text-foreground font-mono tabular-nums">
                    {activeEntry.stability !== null ? activeEntry.stability.toFixed(2) : "--"}
                  </span>
                </div>
                {activeEntry.label && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="text-muted">Label</span>
                    <span className="text-foreground font-mono">{activeEntry.label}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted">Created</span>
                  <span className="text-foreground font-mono tabular-nums">
                    {formatDate(activeEntry.created_at)} {formatTime(activeEntry.created_at)}
                  </span>
                </div>
              </div>

              {/* Script preview */}
              {activeEntry.summary && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Script Preview</span>
                  <div className="text-xs text-muted font-mono leading-relaxed bg-surface-2 rounded-md p-3 max-h-[200px] overflow-y-auto">
                    {activeEntry.summary.substring(0, 500)}
                    {activeEntry.summary.length > 500 && "..."}
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
