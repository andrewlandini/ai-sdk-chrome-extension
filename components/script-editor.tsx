"use client";

import { useState } from "react";

interface ScriptEditorProps {
  script: string;
  title: string;
  isLoading: boolean;
  onScriptChange: (script: string) => void;
  onGenerate: () => void;
}

export function ScriptEditor({
  script,
  title,
  isLoading,
  onScriptChange,
  onGenerate,
}: ScriptEditorProps) {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const charCount = script.length;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">Script</h3>
          {title && (
            <span className="text-xs text-muted font-mono truncate max-w-[300px]">
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {wordCount} words / {charCount} chars
          </span>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Paste a blog URL above or select from the catalog to generate a script..."
          className="w-full min-h-[200px] max-h-[400px] bg-card text-foreground text-sm font-mono leading-relaxed p-4 resize-y focus:outline-none placeholder:text-muted-foreground/40"
          disabled={isLoading}
        />
      </div>

      <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-background">
        <p className="text-xs text-muted-foreground">
          Edit the script before generating audio. The text will be sent to
          ElevenLabs as-is.
        </p>
        <button
          onClick={onGenerate}
          disabled={!script.trim() || isLoading}
          className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating...
            </>
          ) : (
            "Generate Audio"
          )}
        </button>
      </div>
    </div>
  );
}
