"use client";

import { useState, useCallback } from "react";

interface StyleAgentProps {
  sourceScript: string;
  onUseStyledScript: (styledScript: string) => void;
  isGeneratingAudio: boolean;
  onGenerateAudio: (styledScript: string) => void;
  onStyledScriptChange?: (script: string) => void;
  styleVibe?: string;
}

export function StyleAgent({
  sourceScript,
  isGeneratingAudio,
  onGenerateAudio,
  onStyledScriptChange,
  styleVibe = "",
}: StyleAgentProps) {
  const styleInstructions = styleVibe;
  const [styledScript, setStyledScript] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = styledScript.trim().split(/\s+/).filter(Boolean).length;
  const charCount = styledScript.length;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to style script");
    } finally {
      setIsRunning(false);
    }
  }, [sourceScript, styleInstructions]);

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
          className="flex-1 w-full bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-none border-none focus:outline-none overflow-y-auto"
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
