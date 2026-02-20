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
import { PromptEditorModal } from "@/components/prompt-editor-modal";
import type { BlogAudio } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "url" | "catalog";

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "TX3LPaxmHKxFdv7VOQHJ",
  modelId: "eleven_v3",
  stability: 0.5,
  similarityBoost: 0.75,
  label: "",
  testMode: false,
};

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("url");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<BlogAudio | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  const [script, setScript] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");

  const [voiceConfig, setVoiceConfig] =
    useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  const { data: historyData, mutate: mutateHistory } = useSWR<{
    entries: BlogAudio[];
  }>("/api/history", fetcher);

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
          body: JSON.stringify({ url, testMode: voiceConfig.testMode }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to summarize");
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
    [mutateVersions, voiceConfig.testMode]
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
      if (!response.ok)
        throw new Error(data.error || "Failed to generate audio");
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
        if (activeEntry?.id === version.id) setActiveEntry(null);
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
      {/* ── Nav ── */}
      <nav className="h-12 border-b border-border flex items-center px-4 lg:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg height="16" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border text-base select-none" aria-hidden="true">/</span>
          <span className="text-sm font-medium">Blog Audio Generator</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => setPromptEditorOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Prompts</span>
          </button>
          <span className="text-xs text-muted font-mono tabular-nums">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </nav>

      {/* ── Page ── */}
      <main className="flex-1 flex flex-col">
        <div className="w-full max-w-[1200px] mx-auto px-4 lg:px-6 py-8 flex flex-col gap-8 flex-1">

          {/* Page header */}
          <header>
            <h1 className="text-xl font-semibold tracking-tight text-balance">Blog Audio Generator</h1>
            <p className="text-sm text-muted mt-1">
              Turn any blog post into AI-generated audio. Paste a URL, edit the script, configure voice settings, and generate.
            </p>
          </header>

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1 items-start">

            {/* ── Left: Content pipeline ── */}
            <div className="flex flex-col gap-5">

              {/* Step 1: Source */}
              <section className="rounded-lg border border-border bg-surface-1 overflow-hidden" aria-labelledby="source-heading">
                {/* Tabs */}
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setTab("url")}
                    className={`relative px-4 py-3 text-sm font-medium transition-colors focus-ring ${
                      tab === "url" ? "text-foreground" : "text-muted hover:text-foreground"
                    }`}
                    role="tab"
                    aria-selected={tab === "url"}
                  >
                    Paste URL
                    {tab === "url" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t" />
                    )}
                  </button>
                  <button
                    onClick={() => setTab("catalog")}
                    className={`relative px-4 py-3 text-sm font-medium transition-colors focus-ring ${
                      tab === "catalog" ? "text-foreground" : "text-muted hover:text-foreground"
                    }`}
                    role="tab"
                    aria-selected={tab === "catalog"}
                  >
                    Vercel Blog
                    {tab === "catalog" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t" />
                    )}
                  </button>
                </div>

                <div className="p-4">
                  {tab === "url" && (
                    <UrlInput onSubmit={handleSummarize} isLoading={isSummarizing} />
                  )}
                  {tab === "catalog" && (
                    <BlogCatalog onSelect={handleCatalogSelect} />
                  )}
                </div>
              </section>

              {/* Status banner */}
              {error && (
                <div className="flex items-center gap-3 text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded-lg px-4 py-3 animate-fade-in" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4m0 4h.01" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {isSummarizing && (
                <div className="flex items-center gap-3 text-sm text-muted border border-border bg-surface-1 rounded-lg px-4 py-3 animate-fade-in">
                  <svg className="animate-spin text-accent" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Scraping and generating script...</span>
                </div>
              )}

              {/* Step 2: Script editor */}
              <ScriptEditor
                script={script}
                title={scriptTitle}
                isLoading={isGenerating}
                onScriptChange={setScript}
                onGenerate={handleGenerate}
              />

              {/* Audio Player */}
              {activeEntry && (
                <div className="animate-fade-in">
                  <WaveformPlayer
                    key={activeEntry.id}
                    audioUrl={activeEntry.audio_url}
                    title={activeEntry.title || "Untitled"}
                    summary={activeEntry.summary || ""}
                    url={activeEntry.url}
                    autoplay={autoplay}
                  />
                </div>
              )}

              {/* Versions */}
              {scriptUrl && (
                <VersionsList
                  versions={versions}
                  activeId={activeEntry?.id ?? null}
                  onSelect={handleSelectVersion}
                  onDelete={handleDeleteVersion}
                />
              )}
            </div>

            {/* ── Right: Settings + History ── */}
            <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
              <VoiceSettings config={voiceConfig} onChange={setVoiceConfig} />
              <HistoryList
                entries={entries}
                activeId={activeEntry?.id ?? null}
                onSelect={handleSelectHistory}
              />
            </aside>
          </div>
        </div>
      </main>

      {/* Prompt Editor Modal */}
      <PromptEditorModal
        open={promptEditorOpen}
        onClose={() => setPromptEditorOpen(false)}
      />
    </div>
  );
}
