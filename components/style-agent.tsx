"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import type { ChunkMapEntry } from "@/lib/db";

interface HistoryEntry {
  id: number;
  script: string;
  vibe: string;
  timestamp: Date;
  wordCount: number;
  dbId?: number;
}

interface StyleAgentProps {
  sourceScript: string;
  postUrl: string;
  onUseStyledScript: (styledScript: string) => void;
  isGeneratingAudio: boolean;
  onGenerateAudio: (styledScript: string) => void;
  onStyledScriptChange?: (script: string) => void;
  onHistoryChange?: (history: HistoryEntry[]) => void;
  externalScript?: string | null;
  styleVibe?: string;
  dimmed?: boolean;
  // Chunk-aware playback props
  chunkMap?: ChunkMapEntry[] | null;
  currentPlaybackTime?: number;
  isAudioPlaying?: boolean;
  onRegenerateChunk?: (chunkIndex: number, newText: string) => void;
}

export interface StyleAgentHandle {
  runAgent: () => void;
  getStyledScript: () => string;
  isRunning: boolean;
}

export type { HistoryEntry as StyleHistoryEntry };

export const StyleAgent = forwardRef<StyleAgentHandle, StyleAgentProps>(function StyleAgent(
  {
    sourceScript,
    postUrl,
    isGeneratingAudio: _isGeneratingAudio,
    onGenerateAudio: _onGenerateAudio,
    onStyledScriptChange,
    onHistoryChange,
    externalScript,
    styleVibe = "",
    dimmed = false,
    chunkMap,
    currentPlaybackTime = 0,
    isAudioPlaying = false,
    onRegenerateChunk,
  },
  ref,
) {
  const styleInstructions = styleVibe;
  const [styledScript, setStyledScript] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editedChunks, setEditedChunks] = useState<Record<number, string>>({});
  const nextId = useRef(1);
  const chunkRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const wordCount = styledScript.trim().split(/\s+/).filter(Boolean).length;
  const charCount = styledScript.length;

  // Find which chunk is currently playing
  const activeChunkIndex = chunkMap
    ? chunkMap.findIndex(c => currentPlaybackTime >= c.startTime && currentPlaybackTime < c.endTime)
    : -1;

  // Auto-scroll to active chunk during playback
  useEffect(() => {
    if (isAudioPlaying && activeChunkIndex >= 0 && chunkRefs.current[activeChunkIndex]) {
      chunkRefs.current[activeChunkIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeChunkIndex, isAudioPlaying]);

  // Initialize edited chunks from chunk map
  useEffect(() => {
    if (chunkMap) {
      const initial: Record<number, string> = {};
      chunkMap.forEach(c => { initial[c.index] = c.text; });
      setEditedChunks(initial);
    }
  }, [chunkMap]);

  useEffect(() => {
    setStyledScript("");
    setError(null);
    setEditedChunks({});
    if (!postUrl) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/style-history?url=${encodeURIComponent(postUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const entries: HistoryEntry[] = (data.entries || []).map(
          (
            e: {
              id: number;
              script: string;
              vibe: string | null;
              word_count: number;
              created_at: string;
            },
            i: number,
          ) => ({
            id: i + 1,
            dbId: e.id,
            script: e.script,
            vibe: e.vibe || "Default",
            timestamp: new Date(e.created_at),
            wordCount: e.word_count,
          }),
        );
        setHistory(entries);
        nextId.current = entries.length + 1;
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [postUrl]);

  useEffect(() => {
    onHistoryChange?.(history);
  }, [history, onHistoryChange]);

  useEffect(() => {
    if (externalScript != null && externalScript !== styledScript) {
      setStyledScript(externalScript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalScript]);

  const handleRunAgent = useCallback(async () => {
    if (!sourceScript.trim()) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/style-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: sourceScript, styleInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Style agent failed");
      setStyledScript(data.styledScript);
      onStyledScriptChange?.(data.styledScript);

      const wc = data.styledScript.trim().split(/\s+/).filter(Boolean).length;
      try {
        const saveRes = await fetch("/api/style-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: postUrl,
            script: data.styledScript,
            vibe: styleInstructions || "Default",
            word_count: wc,
          }),
        });
        const saveData = await saveRes.json();
        const entry: HistoryEntry = {
          id: nextId.current++,
          dbId: saveData.entry?.id,
          script: data.styledScript,
          vibe: styleInstructions || "Default",
          timestamp: new Date(),
          wordCount: wc,
        };
        setHistory((prev) => [entry, ...prev]);
      } catch {
        const entry: HistoryEntry = {
          id: nextId.current++,
          script: data.styledScript,
          vibe: styleInstructions || "Default",
          timestamp: new Date(),
          wordCount: wc,
        };
        setHistory((prev) => [entry, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to style script");
    } finally {
      setIsRunning(false);
    }
  }, [sourceScript, styleInstructions, postUrl, onStyledScriptChange]);

  useImperativeHandle(
    ref,
    () => ({
      runAgent: handleRunAgent,
      getStyledScript: () => styledScript,
      isRunning,
    }),
    [handleRunAgent, styledScript, isRunning],
  );

  const handleChunkEdit = (index: number, text: string) => {
    setEditedChunks(prev => ({ ...prev, [index]: text }));
    // Also update the full styledScript so the parent stays in sync
    if (chunkMap) {
      const fullText = chunkMap.map(c =>
        c.index === index ? text : (editedChunks[c.index] ?? c.text)
      ).join("\n\n");
      setStyledScript(fullText);
      onStyledScriptChange?.(fullText);
    }
  };

  const isChunkDirty = (chunk: ChunkMapEntry) => {
    const edited = editedChunks[chunk.index];
    return edited !== undefined && edited !== chunk.text;
  };

  // Chunk-aware rendering
  const renderChunks = () => {
    if (!chunkMap || chunkMap.length === 0) return null;

    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        {chunkMap.map((chunk, i) => {
          const isActive = activeChunkIndex === i && isAudioPlaying;
          const dirty = isChunkDirty(chunk);
          const chunkText = editedChunks[chunk.index] ?? chunk.text;

          return (
            <div
              key={chunk.index}
              className={`relative border-b border-border transition-colors duration-200 ${
                isActive
                  ? "bg-accent/10 border-l-2 border-l-accent"
                  : "border-l-2 border-l-transparent"
              }`}
            >
              {/* Chunk header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {i + 1}/{chunkMap.length}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
                    {Math.floor(chunk.startTime / 60)}:{String(Math.floor(chunk.startTime % 60)).padStart(2, "0")}
                    {" - "}
                    {Math.floor(chunk.endTime / 60)}:{String(Math.floor(chunk.endTime % 60)).padStart(2, "0")}
                  </span>
                  {isActive && (
                    <span className="text-[9px] font-medium text-accent uppercase tracking-wider">
                      Playing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {dirty && (
                    <span className="text-[9px] text-amber-400 font-medium">edited</span>
                  )}
                  {dirty && onRegenerateChunk && (
                    <button
                      onClick={() => onRegenerateChunk(chunk.index, editedChunks[chunk.index] ?? chunk.text)}
                      className="text-[10px] text-accent hover:text-accent/80 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-accent/10"
                    >
                      Re-gen
                    </button>
                  )}
                </div>
              </div>

              {/* Chunk textarea - auto-sizes to content */}
              <textarea
                ref={el => {
                  chunkRefs.current[i] = el;
                  // Auto-size on mount and content change
                  if (el) {
                    el.style.height = "0";
                    el.style.height = el.scrollHeight + "px";
                  }
                }}
                value={chunkText}
                onChange={(e) => {
                  handleChunkEdit(chunk.index, e.target.value);
                  // Auto-resize on input
                  e.target.style.height = "0";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                className={`w-full bg-transparent text-xs font-mono leading-relaxed text-foreground px-3 py-2 resize-none border-none focus:outline-none transition-opacity duration-300 overflow-hidden ${
                  dimmed && !isActive ? "opacity-30 hover:opacity-100 focus:opacity-100" : ""
                }`}
                rows={1}
                aria-label={`Chunk ${i + 1} of styled script`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div
          className="flex-shrink-0 mx-4 mt-3 flex items-center gap-2 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded px-3 py-2"
          role="alert"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {chunkMap && chunkMap.length > 0 ? (
        // Chunk-aware view
        renderChunks()
      ) : styledScript ? (
        <textarea
          value={styledScript}
          onChange={(e) => {
            setStyledScript(e.target.value);
            onStyledScriptChange?.(e.target.value);
          }}
          aria-label="Styled audio script with Audio Tags"
          className={`flex-1 w-full bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-none border-none focus:outline-none overflow-y-auto transition-opacity duration-300 ${dimmed ? "opacity-30 hover:opacity-100 focus:opacity-100" : ""}`}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 gap-5">
          <div className="w-14 h-14 rounded-full border border-muted-foreground/20 flex items-center justify-center">
            {isRunning ? (
              <svg className="animate-spin text-muted-foreground" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" aria-hidden="true">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-[280px]">
            {isRunning
              ? "Analyzing script and applying performance direction..."
              : "Click Style Script to generate a styled version with Audio Tags."}
          </p>
        </div>
      )}

      {(styledScript || (chunkMap && chunkMap.length > 0)) && (
        <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-between">
          {chunkMap && chunkMap.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              {chunkMap.length} chunks
            </span>
          )}
          <span className="text-[10px] text-muted font-mono tabular-nums flex-shrink-0 ml-auto">
            {wordCount}w / {charCount}c
          </span>
        </div>
      )}
    </div>
  );
});
