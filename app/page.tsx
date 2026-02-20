"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { UrlInput } from "@/components/url-input";
import { WaveformPlayer } from "@/components/waveform-player";
import { HistoryList } from "@/components/history-list";
import { BlogCatalog } from "@/components/blog-catalog";
import { ScriptEditor } from "@/components/script-editor";
import { VoiceSettings, type VoiceConfig } from "@/components/voice-settings";
import { VersionsList } from "@/components/versions-list";
import type { BlogAudio } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "url" | "catalog";

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "JBFqnCBsd6RMkjVDRZzb",
  modelId: "eleven_flash_v2_5",
  stability: 0.5,
  similarityBoost: 0.75,
  label: "",
};

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("url");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<BlogAudio | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  // Script state
  const [script, setScript] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");

  // Voice config
  const [voiceConfig, setVoiceConfig] =
    useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);

  // History
  const { data: historyData, mutate: mutateHistory } = useSWR<{
    entries: BlogAudio[];
  }>("/api/history", fetcher);

  // Versions for current URL
  const { data: versionsData, mutate: mutateVersions } = useSWR<{
    versions: BlogAudio[];
  }>(
    scriptUrl ? `/api/versions?url=${encodeURIComponent(scriptUrl)}` : null,
    fetcher
  );

  const handleSummarize = useCallback(
    async (url: string) => {
      setIsSummarizing(true);
      setError(null);
      setScriptUrl(url);

      try {
        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to summarize");
        }

        setScript(data.summary);
        setScriptTitle(data.title);
        setScriptUrl(data.url);
        mutateVersions();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setIsSummarizing(false);
      }
    },
    [mutateVersions]
  );

  const handleCatalogSelect = useCallback(
    (url: string, title: string) => {
      setScriptTitle(title);
      handleSummarize(url);
    },
    [handleSummarize]
  );

  const handleGenerate = useCallback(async () => {
    if (!script.trim() || !scriptUrl) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: scriptUrl,
          title: scriptTitle,
          summary: script,
          voiceId: voiceConfig.voiceId,
          modelId: voiceConfig.modelId,
          stability: voiceConfig.stability,
          similarityBoost: voiceConfig.similarityBoost,
          label: voiceConfig.label || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate audio");
      }

      setActiveEntry(data.entry);
      setAutoplay(true);
      mutateHistory();
      mutateVersions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    script,
    scriptUrl,
    scriptTitle,
    voiceConfig,
    mutateHistory,
    mutateVersions,
  ]);

  const handleDeleteVersion = useCallback(
    async (version: BlogAudio) => {
      try {
        await fetch("/api/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: version.id, audioUrl: version.audio_url }),
        });

        if (activeEntry?.id === version.id) {
          setActiveEntry(null);
        }
        mutateVersions();
        mutateHistory();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },
    [activeEntry, mutateVersions, mutateHistory]
  );

  const handleSelectVersion = useCallback((version: BlogAudio) => {
    setActiveEntry(version);
    setAutoplay(true);
    setError(null);
  }, []);

  const handleSelectHistory = useCallback(
    (entry: BlogAudio) => {
      setActiveEntry(entry);
      setAutoplay(true);
      setError(null);
      // Load the script from this entry
      setScript(entry.summary || "");
      setScriptTitle(entry.title || "");
      setScriptUrl(entry.url);
      mutateVersions();
    },
    [mutateVersions]
  );

  const entries = historyData?.entries ?? [];
  const versions = versionsData?.versions ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="h-14 border-b border-border flex items-center px-6">
        <div className="flex items-center gap-3">
          <svg height="18" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border text-lg select-none">/</span>
          <span className="text-sm font-medium text-foreground">
            Blog Audio Generator
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto w-full px-6 py-8">
          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left column: Input + Script + Player */}
            <div className="flex flex-col gap-6">
              {/* Source tabs */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-0 border-b border-border">
                  <button
                    onClick={() => setTab("url")}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                      tab === "url"
                        ? "text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Paste URL
                    {tab === "url" && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => setTab("catalog")}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                      tab === "catalog"
                        ? "text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Vercel Blog
                    {tab === "catalog" && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                    )}
                  </button>
                </div>

                {tab === "url" && (
                  <UrlInput
                    onSubmit={handleSummarize}
                    isLoading={isSummarizing}
                  />
                )}
                {tab === "catalog" && (
                  <BlogCatalog onSelect={handleCatalogSelect} />
                )}
              </div>

              {/* Status Messages */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive border border-destructive/20 rounded-md px-4 py-3">
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

              {isSummarizing && (
                <div className="flex items-center gap-3 text-sm text-muted border border-border rounded-md px-4 py-3">
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
                  <span>Scraping and generating script...</span>
                </div>
              )}

              {/* Script Editor */}
              <ScriptEditor
                script={script}
                title={scriptTitle}
                isLoading={isGenerating}
                onScriptChange={setScript}
                onGenerate={handleGenerate}
              />

              {/* Audio Player */}
              {activeEntry && (
                <WaveformPlayer
                  key={activeEntry.id}
                  audioUrl={activeEntry.audio_url}
                  title={activeEntry.title || "Untitled"}
                  summary={activeEntry.summary || ""}
                  url={activeEntry.url}
                  autoplay={autoplay}
                />
              )}

              {/* Versions for current URL */}
              {scriptUrl && (
                <VersionsList
                  versions={versions}
                  activeId={activeEntry?.id ?? null}
                  onSelect={handleSelectVersion}
                  onDelete={handleDeleteVersion}
                />
              )}
            </div>

            {/* Right column: Settings + History */}
            <div className="flex flex-col gap-6">
              <VoiceSettings
                config={voiceConfig}
                onChange={setVoiceConfig}
              />

              {/* History */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-foreground px-0.5">
                  History
                </h3>
                <div className="border border-border rounded-md overflow-hidden">
                  <HistoryList
                    entries={entries}
                    activeId={activeEntry?.id ?? null}
                    onSelect={handleSelectHistory}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
