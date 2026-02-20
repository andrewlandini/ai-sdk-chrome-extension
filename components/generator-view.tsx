"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { UrlInput } from "@/components/url-input";
import { BlogCatalog } from "@/components/blog-catalog";
import { ScriptEditor } from "@/components/script-editor";
import { StyleAgent } from "@/components/style-agent";
import { VoiceSettings, type VoiceConfig } from "@/components/voice-settings";
import { VersionsList } from "@/components/versions-list";
import { WaveformPlayer } from "@/components/waveform-player";
import type { BlogAudio } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SourceTab = "url" | "catalog";

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "TX3LPaxmHKxFdv7VOQHJ",
  stability: 0,
  label: "",
  testMode: false,
};

interface GeneratorViewProps {
  script: string;
  scriptTitle: string;
  scriptUrl: string;
  activeEntry: BlogAudio | null;
  autoplay: boolean;
  onScriptChange: (s: string) => void;
  onScriptTitleChange: (t: string) => void;
  onScriptUrlChange: (u: string) => void;
  onActiveEntryChange: (e: BlogAudio | null) => void;
  onAutoplayChange: (a: boolean) => void;
  mutateHistory: () => void;
}

export function GeneratorView({
  script,
  scriptTitle,
  scriptUrl,
  activeEntry,
  autoplay,
  onScriptChange,
  onScriptTitleChange,
  onScriptUrlChange,
  onActiveEntryChange,
  onAutoplayChange,
  mutateHistory,
}: GeneratorViewProps) {
  const [sourceTab, setSourceTab] = useState<SourceTab>("url");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);

  const { data: versionsData, mutate: mutateVersions } = useSWR<{
    versions: BlogAudio[];
  }>(
    scriptUrl ? `/api/versions?url=${encodeURIComponent(scriptUrl)}` : null,
    fetcher
  );

  const versions = versionsData?.versions ?? [];

  const handleSummarize = useCallback(
    async (url: string) => {
      setIsSummarizing(true);
      setError(null);
      onScriptUrlChange(url);
      try {
        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, testMode: voiceConfig.testMode }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to summarize");
        onScriptChange(data.summary);
        onScriptTitleChange(data.title);
        onScriptUrlChange(data.url);
        mutateVersions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setIsSummarizing(false);
      }
    },
    [mutateVersions, voiceConfig.testMode, onScriptChange, onScriptTitleChange, onScriptUrlChange]
  );

  // Catalog select only populates the URL/title -- user must click Generate Script
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const handleCatalogSelect = useCallback(
    (url: string, title: string) => {
      onScriptTitleChange(title);
      onScriptUrlChange(url);
      setPendingUrl(url);
    },
    [onScriptTitleChange, onScriptUrlChange]
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
          stability: voiceConfig.stability,
          label: voiceConfig.label || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate audio");
      onActiveEntryChange(data.entry);
      onAutoplayChange(true);
      mutateHistory();
      mutateVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  }, [script, scriptUrl, scriptTitle, voiceConfig, mutateHistory, mutateVersions, onActiveEntryChange, onAutoplayChange]);

  const handleGenerateFromStyled = useCallback(
    async (styledScript: string) => {
      if (!styledScript.trim() || !scriptUrl) return;
      setIsGenerating(true);
      setError(null);
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: scriptUrl,
            title: scriptTitle,
            summary: styledScript,
            voiceId: voiceConfig.voiceId,
            stability: voiceConfig.stability,
            label: voiceConfig.label ? `${voiceConfig.label} (styled)` : "styled",
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to generate audio");
        onActiveEntryChange(data.entry);
        onAutoplayChange(true);
        mutateHistory();
        mutateVersions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setIsGenerating(false);
      }
    },
    [scriptUrl, scriptTitle, voiceConfig, mutateHistory, mutateVersions, onActiveEntryChange, onAutoplayChange]
  );

  const handleDeleteVersion = useCallback(
    async (version: BlogAudio) => {
      try {
        await fetch("/api/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: version.id, audioUrl: version.audio_url }),
        });
        if (activeEntry?.id === version.id) onActiveEntryChange(null);
        mutateVersions();
        mutateHistory();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },
    [activeEntry, mutateVersions, mutateHistory, onActiveEntryChange]
  );

  const handleSelectVersion = useCallback(
    (version: BlogAudio) => {
      onActiveEntryChange(version);
      onAutoplayChange(true);
      setError(null);
    },
    [onActiveEntryChange, onAutoplayChange]
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Main workspace (scrollable) ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[840px] mx-auto px-6 py-6 flex flex-col gap-5">
          {/* Header */}
          <header>
            <h1 className="text-lg font-semibold tracking-tight">Generator</h1>
            <p className="text-xs text-muted mt-0.5">
              Paste a URL or select from the catalog, edit the script, then generate audio.
            </p>
          </header>

          {/* Source tabs */}
          <section className="rounded-lg border border-border bg-surface-1 overflow-hidden" aria-labelledby="source-heading">
            <div className="flex border-b border-border">
              <button
                onClick={() => setSourceTab("url")}
                className={`relative px-4 py-2.5 text-xs font-medium transition-colors focus-ring ${
                  sourceTab === "url" ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
                role="tab"
                aria-selected={sourceTab === "url"}
              >
                Paste URL
                {sourceTab === "url" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t" />
                )}
              </button>
              <button
                onClick={() => setSourceTab("catalog")}
                className={`relative px-4 py-2.5 text-xs font-medium transition-colors focus-ring ${
                  sourceTab === "catalog" ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
                role="tab"
                aria-selected={sourceTab === "catalog"}
              >
                Vercel Blog
                {sourceTab === "catalog" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t" />
                )}
              </button>
            </div>
            <div className="p-4">
              {sourceTab === "url" && (
                <UrlInput onSubmit={handleSummarize} isLoading={isSummarizing} />
              )}
              {sourceTab === "catalog" && (
                <div className="flex flex-col gap-3">
                  <BlogCatalog onSelect={handleCatalogSelect} />
                  {pendingUrl && !isSummarizing && (
                    <div className="flex items-center gap-3 border border-border rounded-md bg-surface-2 px-3 py-2">
                      <span className="flex-1 text-xs font-mono text-muted truncate" title={pendingUrl}>
                        {pendingUrl}
                      </span>
                      <button
                        onClick={() => {
                          handleSummarize(pendingUrl);
                          setPendingUrl(null);
                        }}
                        className="flex items-center justify-center gap-2 h-8 rounded-md bg-foreground text-background px-4 text-xs font-medium transition-colors hover:bg-foreground/90 focus-ring flex-shrink-0"
                      >
                        Generate Script
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Status */}
          {error && (
            <div className="flex items-center gap-3 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-lg px-4 py-2.5" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {isSummarizing && (
            <div className="flex items-center gap-3 text-xs text-muted border border-border bg-surface-1 rounded-lg px-4 py-2.5">
              <svg className="animate-spin text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Scraping and generating script...</span>
            </div>
          )}

          {/* Script editor */}
          <ScriptEditor
            script={script}
            title={scriptTitle}
            isLoading={isGenerating}
            onScriptChange={onScriptChange}
            onGenerate={handleGenerate}
          />

          {/* Style Agent */}
          <StyleAgent
            sourceScript={script}
            onUseStyledScript={onScriptChange}
            isGeneratingAudio={isGenerating}
            onGenerateAudio={handleGenerateFromStyled}
          />

          {/* Player */}
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
      </div>

      {/* ── Right sidebar: Voice Settings ── */}
      <aside className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto bg-surface-1 hidden lg:block">
        <div className="p-4">
          <VoiceSettings config={voiceConfig} onChange={setVoiceConfig} />
        </div>
      </aside>
    </div>
  );
}
