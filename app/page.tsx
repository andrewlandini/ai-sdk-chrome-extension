"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { UrlInput } from "@/components/url-input";
import { WaveformPlayer } from "@/components/waveform-player";
import { HistoryList } from "@/components/history-list";
import type { BlogAudio } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function HomePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<BlogAudio | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  const {
    data: historyData,
    mutate: mutateHistory,
  } = useSWR<{ entries: BlogAudio[] }>("/api/history", fetcher);

  const handleGenerate = useCallback(
    async (url: string) => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate audio");
        }

        setActiveEntry(data.entry);
        setAutoplay(true);

        // Refresh history
        mutateHistory();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [mutateHistory]
  );

  const handleSelectEntry = useCallback((entry: BlogAudio) => {
    setActiveEntry(entry);
    setAutoplay(true);
    setError(null);
  }, []);

  const entries = historyData?.entries ?? [];

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-card-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <h1 className="text-sm font-semibold text-foreground">
              Blog Audio Generator
            </h1>
          </div>
          <span className="text-xs text-muted-foreground">
            Paste a blog URL, get an AI audio summary
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* URL Input Section */}
        <section className="flex flex-col gap-3">
          <UrlInput onSubmit={handleGenerate} isLoading={isGenerating} />

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive rounded-lg bg-destructive/10 px-4 py-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="flex items-center gap-3 text-sm text-muted rounded-lg border border-card-border bg-card px-4 py-3">
              <svg
                className="animate-spin text-muted-foreground"
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
              <span>
                Scraping blog, generating summary, and creating audio...
              </span>
            </div>
          )}
        </section>

        {/* Audio Player Section */}
        {activeEntry && (
          <section>
            <WaveformPlayer
              key={activeEntry.id}
              audioUrl={activeEntry.audio_url}
              title={activeEntry.title || "Untitled"}
              summary={activeEntry.summary || ""}
              autoplay={autoplay}
            />
          </section>
        )}

        {/* History Section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">History</h2>
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <HistoryList
            entries={entries}
            activeId={activeEntry?.id ?? null}
            onSelect={handleSelectEntry}
          />
        </section>
      </div>
    </main>
  );
}
