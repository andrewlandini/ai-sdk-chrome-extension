"use client";

import { useState } from "react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      return;
    }

    onSubmit(trimmed);
  };

  const isValidUrl = (() => {
    try {
      if (!url.trim()) return false;
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  })();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/blog-post"
            disabled={isLoading}
            className="w-full rounded-lg border border-card-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-muted transition-colors disabled:opacity-50 font-mono"
            aria-label="Blog post URL"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !isValidUrl}
          className="flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-5 py-3 text-sm font-medium hover:opacity-90 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeOpacity="0.25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
              </svg>
              <span>Generate Audio</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
