"use client";

interface ScriptEditorProps {
  script: string;
  title: string;
  isLoading: boolean;
  onScriptChange: (script: string) => void;
}

export function ScriptEditor({
  script,
  title,
  isLoading,
  onScriptChange,
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
        className="w-full h-[200px] bg-transparent text-sm font-mono leading-relaxed text-foreground p-4 resize-none border-none focus:outline-none placeholder:text-muted-foreground/30 disabled:opacity-50 overflow-y-auto"
      />

      {/* Footer */}
      <div className="border-t border-border px-4 py-2">
        <p className="text-[11px] text-muted">
          Source script from the blog post. Run the Style Agent below to add Audio Tags before generating.
        </p>
      </div>
    </section>
  );
}
