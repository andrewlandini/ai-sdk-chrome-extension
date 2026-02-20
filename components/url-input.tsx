"use client";

import { useState } from "react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError("URL is required");
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setValidationError("Please enter a valid URL");
      return;
    }
    setValidationError(null);
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="https://vercel.com/blog/example-post"
            disabled={isLoading}
            aria-label="Blog post URL"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? "url-error" : undefined}
            className="w-full h-10 rounded-md border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus-ring disabled:opacity-50 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="flex items-center justify-center gap-2 h-10 rounded-md bg-foreground text-background px-5 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 focus-ring"
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
            <span>Generate Script</span>
          )}
        </button>
      </div>
      {validationError && (
        <p id="url-error" className="text-xs text-destructive pl-1" role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}
