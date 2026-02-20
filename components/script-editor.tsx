"use client";

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
    <section
      className="rounded-lg border border-border bg-surface-1 overflow-hidden"
      aria-labelledby="script-heading"
    >
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h2 id="script-heading" className="text-sm font-medium text-foreground flex-shrink-0">
            Script
          </h2>
          {title && (
            <span className="text-xs text-muted font-mono truncate" title={title}>
              {title}
            </span>
          )}
        </div>
        <span className="text-xs text-muted font-mono tabular-nums flex-shrink-0">
          {wordCount}w / {charCount}c
        </span>
      </div>

      {/* Editor */}
      <textarea
        value={script}
        onChange={(e) => onScriptChange(e.target.value)}
        placeholder="Click Generate Script to create an audio script from the blog post..."
        disabled={isLoading}
        aria-label="Audio script text"
        className={`w-full bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-y border-none focus:outline-none placeholder:text-muted-foreground/30 disabled:opacity-50 ${
          script ? "min-h-[160px] max-h-[440px]" : "min-h-[64px] max-h-[440px]"
        }`}
      />

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-muted hidden sm:block">
          Edit the script before generating. This text is sent directly to ElevenLabs.
        </p>
        <button
          onClick={onGenerate}
          disabled={!script.trim() || isLoading}
          className="ml-auto flex items-center justify-center gap-2 h-9 rounded-md bg-foreground text-background px-5 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <span>Generate Audio</span>
          )}
        </button>
      </div>
    </section>
  );
}
