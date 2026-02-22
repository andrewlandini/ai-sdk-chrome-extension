"use client";

interface ScriptEditorProps {
  script: string;
  title: string;
  isLoading: boolean;
  isStreaming?: boolean;
  isStyled?: boolean;
  onScriptChange: (script: string) => void;
}

export function ScriptEditor({
  script,
  isLoading,
  isStreaming,
  isStyled,
  onScriptChange,
}: ScriptEditorProps) {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const charCount = script.length;

  return (
    <div className="flex flex-col h-full">
      {/* Editor */}
      <textarea
        value={script}
        onChange={(e) => onScriptChange(e.target.value)}
        placeholder="Select a blog post and click Generate Script to fetch the content..."
        disabled={isLoading}
        aria-label="Blog post script content"
        className={`flex-1 w-full bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-none border-none focus:outline-none placeholder:text-muted-foreground/30 disabled:opacity-50 overflow-y-auto transition-opacity duration-300 ${
          script && !isStreaming && isStyled
            ? "opacity-30 hover:opacity-100 focus:opacity-100"
            : ""
        }`}
      />

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-between">
        {isStreaming ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin text-accent" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-[11px] text-accent font-medium">Streaming script...</p>
          </div>
        ) : null}
        <span className="text-[10px] text-muted font-mono tabular-nums flex-shrink-0">
          {wordCount}w / {charCount}c
        </span>
      </div>
    </div>
  );
}
