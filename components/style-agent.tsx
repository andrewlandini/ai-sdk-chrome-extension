"use client";

import { useState, useCallback } from "react";

interface StyleAgentProps {
  sourceScript: string;
  onUseStyledScript: (styledScript: string) => void;
  isGeneratingAudio: boolean;
  onGenerateAudio: (styledScript: string) => void;
}

export function StyleAgent({
  sourceScript,
  onUseStyledScript,
  isGeneratingAudio,
  onGenerateAudio,
}: StyleAgentProps) {
  const [styleInstructions, setStyleInstructions] = useState("Confident and genuinely excited about the content, but grounded and conversational -- not over the top");
  const [styledScript, setStyledScript] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to style script");
    } finally {
      setIsRunning(false);
    }
  }, [sourceScript, styleInstructions]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={!sourceScript.trim()}
        className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-3 py-2 border border-dashed border-border hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed w-full justify-center"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 3Z" />
          <path d="M17 4a2 2 0 0 1 2 2" />
          <path d="M21 8a6 6 0 0 1-6 6" />
        </svg>
        <span>Style Agent -- Add v3 Audio Tags</span>
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-accent/30 bg-surface-1 overflow-hidden animate-fade-in" aria-labelledby="style-agent-heading">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
            <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 3Z" />
            <path d="M17 4a2 2 0 0 1 2 2" />
            <path d="M21 8a6 6 0 0 1-6 6" />
          </svg>
          <h2 id="style-agent-heading" className="text-sm font-medium text-foreground">
            Style Agent
          </h2>
          <span className="text-xs text-muted">v3 Audio Tags</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted hover:text-foreground transition-colors p-1 focus-ring rounded"
          aria-label="Close style agent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Style instructions input */}
      <div className="border-b border-border px-4 py-3">
        <label className="block text-xs text-muted mb-1.5">
          Style / vibe instructions (optional -- leave blank for natural performance)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={styleInstructions}
            onChange={(e) => setStyleInstructions(e.target.value)}
            placeholder="e.g. warm and excited podcast host, dramatic movie trailer, calm bedtime story..."
            className="flex-1 h-9 bg-surface-2 border border-border rounded-md px-3 text-sm text-foreground font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isRunning && sourceScript.trim()) {
                handleRunAgent();
              }
            }}
          />
          <button
            onClick={handleRunAgent}
            disabled={isRunning || !sourceScript.trim()}
            className="flex items-center justify-center gap-2 h-9 rounded-md bg-accent text-primary-foreground px-4 text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed focus-ring flex-shrink-0"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Styling...</span>
              </>
            ) : (
              <span>Run</span>
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted mt-1.5">
          The agent will add [emotion], [pause], [whispering], and other Audio Tags to the original script.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded px-3 py-2" role="alert">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Styled script output */}
      {styledScript ? (
        <>
          <div className="px-4 pt-3 flex items-center justify-between">
            <span className="text-xs text-muted font-mono tabular-nums">{wordCount}w / {charCount}c</span>
            <button
              onClick={() => onUseStyledScript(styledScript)}
              className="text-xs text-accent hover:text-accent-hover transition-colors focus-ring rounded px-2 py-1"
            >
              Copy to main script
            </button>
          </div>
          <textarea
            value={styledScript}
            onChange={(e) => setStyledScript(e.target.value)}
            aria-label="Styled audio script with Audio Tags"
            className="w-full h-[200px] bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-none border-none focus:outline-none overflow-y-auto"
          />
          <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-muted hidden sm:block">
              This styled version will be sent to ElevenLabs v3 with Audio Tags.
            </p>
            <button
              onClick={() => onGenerateAudio(styledScript)}
              disabled={!styledScript.trim() || isGeneratingAudio}
              className="ml-auto flex items-center justify-center gap-2 h-9 rounded-md bg-foreground text-background px-5 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
            >
              {isGeneratingAudio ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <span>Generate from Styled</span>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="h-[200px] flex items-center justify-center px-4 text-center">
          <p className="text-sm text-muted">
            {isRunning
              ? "Analyzing script and applying performance direction..."
              : "Enter a style above and click Run to generate a styled version with Audio Tags."}
          </p>
        </div>
      )}
    </section>
  );
}
