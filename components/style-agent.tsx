"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface HistoryEntry {
  id: number;
  script: string;
  vibe: string;
  timestamp: Date;
  wordCount: number;
  dbId?: number; // ID from the database
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
}

export type { HistoryEntry as StyleHistoryEntry };

export function StyleAgent({
  sourceScript,
  postUrl,
  isGeneratingAudio,
  onGenerateAudio,
  onStyledScriptChange,
  onHistoryChange,
  externalScript,
  styleVibe = "",
  dimmed = false,
}: StyleAgentProps) {
  const styleInstructions = styleVibe;
  const [styledScript, setStyledScript] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const nextId = useRef(1);

  const wordCount = styledScript.trim().split(/\s+/).filter(Boolean).length;
  const charCount = styledScript.length;

  // Load history from DB when post URL changes
  useEffect(() => {
    if (!postUrl) { setHistory([]); return; }
    let cancelled = false;
    fetch(`/api/style-history?url=${encodeURIComponent(postUrl)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const entries: HistoryEntry[] = (data.entries || []).map((e: { id: number; script: string; vibe: string | null; word_count: number; created_at: string }, i: number) => ({
          id: i + 1,
          dbId: e.id,
          script: e.script,
          vibe: e.vibe || "Default",
          timestamp: new Date(e.created_at),
          wordCount: e.word_count,
        }));
        setHistory(entries);
        nextId.current = entries.length + 1;
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [postUrl]);

  // Notify parent of history changes
  useEffect(() => {
    onHistoryChange?.(history);
  }, [history, onHistoryChange]);

  // Sync when parent pushes a script from history selection
  useEffect(() => {
    if (externalScript != null && externalScript !== styledScript) {
      setStyledScript(externalScript);
    }
  }, [externalScript]);

  const handleRunAgent = useCallback(async () => {
    if (!sourceScript.trim()) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/style-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: sourceScript,
          styleInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Style agent failed");
      setStyledScript(data.styledScript);
      onStyledScriptChange?.(data.styledScript);

      // Save to DB and add to local history
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
        setHistory(prev => [entry, ...prev]);
      } catch {
        // Fallback to local-only if save fails
        const entry: HistoryEntry = {
          id: nextId.current++,
          script: data.styledScript,
          vibe: styleInstructions || "Default",
          timestamp: new Date(),
          wordCount: wc,
        };
        setHistory(prev => [entry, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to style script");
    } finally {
      setIsRunning(false);
    }
  }, [sourceScript, styleInstructions, postUrl, onStyledScriptChange]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setStyledScript(entry.script);
    onStyledScriptChange?.(entry.script);
  }, [onStyledScriptChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Run bar */}
      <div className="flex-shrink-0 border-b border-border px-4 py-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted truncate">
          {styleInstructions
            ? <span>Vibe: <span className="text-muted-foreground">{styleInstructions}</span></span>
            : "Adds Audio Tags to the script."}
        </p>
        <button
          onClick={handleRunAgent}
          disabled={isRunning || !sourceScript.trim()}
          className="flex items-center justify-center gap-2 h-7 rounded-md bg-accent text-primary-foreground px-3 text-xs font-medium transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed focus-ring flex-shrink-0"
        >
          {isRunning ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Styling...</span>
            </>
          ) : (
            <span>Style Script</span>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 mx-4 mt-3 flex items-center gap-2 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded px-3 py-2" role="alert">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Styled script output */}
      {styledScript ? (
        <textarea
          value={styledScript}
          onChange={(e) => { setStyledScript(e.target.value); onStyledScriptChange?.(e.target.value); }}
          aria-label="Styled audio script with Audio Tags"
          className={`flex-1 w-full bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-none border-none focus:outline-none overflow-y-auto transition-opacity duration-300 ${dimmed ? "opacity-30 hover:opacity-100 focus:opacity-100" : ""}`}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-sm text-muted">
            {isRunning
              ? "Analyzing script and applying performance direction..."
              : "Click Style Script to generate a styled version with Audio Tags."}
          </p>
        </div>
      )}

      {/* Footer */}
      {styledScript && (
        <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-end">
          <span className="text-[10px] text-muted font-mono tabular-nums flex-shrink-0">
            {wordCount}w / {charCount}c
          </span>
        </div>
      )}
    </div>
  );
}
