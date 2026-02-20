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

  const { data: historyData, mutate: mutateHistory } = useSWR<{
    entries: BlogAudio[];
  }>("/api/history", fetcher);

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
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="h-16 border-b border-border flex items-center px-6">
        <div className="flex items-center gap-3">
          {/* Vercel Triangle */}
          <svg height="18" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border text-lg select-none">/</span>
          <span className="text-sm font-medium text-foreground">
            Blog Audio Generator
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-muted font-mono px-2 py-1 rounded border border-border">
            AI SDK + ElevenLabs
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <div className="border-b border-border">
          <div className="max-w-3xl mx-auto w-full px-6 py-16">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3 text-balance">
              Blog to Audio
            </h1>
            <p className="text-base text-muted mb-8 max-w-xl">
              Paste any blog post URL. We scrape the content, generate an
              AI summary, and convert it to speech.
            </p>
            <UrlInput onSubmit={handleGenerate} isLoading={isGenerating} />

            {/* Status Messages */}
            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive border border-destructive/20 rounded-md px-4 py-3">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            {isGenerating && (
              <div className="mt-4 flex items-center gap-3 text-sm text-muted border border-border rounded-md px-4 py-3">
                <svg
                  className="animate-spin text-accent"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
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
                  Scraping content, generating summary, and creating audio...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Player + History */}
        <div className="max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-10">
          {/* Audio Player */}
          {activeEntry && (
            <section>
              <WaveformPlayer
                key={activeEntry.id}
                audioUrl={activeEntry.audio_url}
                title={activeEntry.title || "Untitled"}
                summary={activeEntry.summary || ""}
                url={activeEntry.url}
                autoplay={autoplay}
              />
            </section>
          )}

          {/* History */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">History</h2>
              {entries.length > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {entries.length}{" "}
                  {entries.length === 1 ? "entry" : "entries"}
                </span>
              )}
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <HistoryList
                entries={entries}
                activeId={activeEntry?.id ?? null}
                onSelect={handleSelectEntry}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
