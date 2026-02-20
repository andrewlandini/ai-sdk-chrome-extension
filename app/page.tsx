"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { PostsList } from "@/components/posts-list";
import { ScriptEditor } from "@/components/script-editor";
import { StyleAgent } from "@/components/style-agent";
import { VoiceSettings, type VoiceConfig } from "@/components/voice-settings";
import { VersionsList } from "@/components/versions-list";
import { WaveformPlayer } from "@/components/waveform-player";
import { PromptEditorModal } from "@/components/prompt-editor-modal";
import type { BlogAudio } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "TX3LPaxmHKxFdv7VOQHJ",
  stability: 0,
  label: "",
  testMode: false,
};

export default function HomePage() {
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [scriptProgress, setScriptProgress] = useState({ done: 0, total: 0 });

  // Active selection
  const [activeEntry, setActiveEntry] = useState<BlogAudio | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  // Generator state
  const [script, setScript] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);

  // Data
  const { data: historyData, mutate: mutateHistory } = useSWR<{ entries: BlogAudio[] }>("/api/history", fetcher);
  const entries = historyData?.entries ?? [];

  const { data: versionsData, mutate: mutateVersions } = useSWR<{ versions: BlogAudio[] }>(
    scriptUrl ? `/api/versions?url=${encodeURIComponent(scriptUrl)}` : null,
    fetcher
  );
  const versions = versionsData?.versions ?? [];

  // ── Handlers ──

  const handleSelectPost = useCallback((url: string, title: string) => {
    setScriptUrl(url);
    setScriptTitle(title);
    setError(null);
    setActiveEntry(null);

    // Check if there's a cached script for this post
    const entry = entries.find((e) => e.url === url);
    const cachedScript = (entry as BlogAudio & { cached_script?: string | null })?.cached_script;
    setScript(cachedScript || "");
  }, [entries]);

  const handleGenerateScript = useCallback(async () => {
    if (!scriptUrl) return;
    setIsSummarizing(true);
    setError(null);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scriptUrl, testMode: voiceConfig.testMode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to summarize");
      setScript(data.summary);
      setScriptTitle(data.title);
      setScriptUrl(data.url);
      mutateVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSummarizing(false);
    }
  }, [scriptUrl, voiceConfig.testMode, mutateVersions]);

  const handleGenerateAudio = useCallback(async () => {
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
      setActiveEntry(data.entry);
      setAutoplay(true);
      mutateHistory();
      mutateVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  }, [script, scriptUrl, scriptTitle, voiceConfig, mutateHistory, mutateVersions]);

  const handleGenerateFromStyled = useCallback(async (styledScript: string) => {
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
      setActiveEntry(data.entry);
      setAutoplay(true);
      mutateHistory();
      mutateVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  }, [scriptUrl, scriptTitle, voiceConfig, mutateHistory, mutateVersions]);

  const handleDeleteVersion = useCallback(async (version: BlogAudio) => {
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
  }, [activeEntry, mutateVersions, mutateHistory]);

  const handleSelectVersion = useCallback((version: BlogAudio) => {
    setActiveEntry(version);
    setAutoplay(true);
    setError(null);
  }, []);

  const handlePlayFromList = useCallback((entry: BlogAudio) => {
    setActiveEntry(entry);
    setAutoplay(true);
    setScriptUrl(entry.url);
    setScriptTitle(entry.title || "");
    setScript(entry.summary || "");
  }, []);

  const handleDeleteEntry = useCallback(async (entry: BlogAudio) => {
    try {
      await fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, audioUrl: entry.audio_url }),
      });
      if (activeEntry?.id === entry.id) setActiveEntry(null);
      mutateHistory();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }, [activeEntry, mutateHistory]);

  const handleLoadScripts = useCallback(async () => {
    // Get all cached posts without scripts
    const res = await fetch("/api/history");
    const data = await res.json();
    const allEntries: BlogAudio[] = data.entries ?? [];

    // Unique URLs from cached posts (id === -1 means no audio, just cached post)
    // We want all unique URLs that don't already have a script loaded
    const uniqueUrls = new Map<string, string>();
    for (const entry of allEntries) {
      if (!uniqueUrls.has(entry.url)) {
        uniqueUrls.set(entry.url, entry.title || "Untitled");
      }
    }

    const urlList = Array.from(uniqueUrls.entries());
    setLoadingScripts(true);
    setScriptProgress({ done: 0, total: urlList.length });

    for (let i = 0; i < urlList.length; i++) {
      const [url] = urlList[i];
      try {
        const sumRes = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          // Save script to blog_posts_cache
          await fetch("/api/save-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, script: sumData.summary }),
          });
        }
      } catch (err) {
        console.error(`Failed to load script for ${url}:`, err);
      }
      setScriptProgress({ done: i + 1, total: urlList.length });
    }

    setLoadingScripts(false);
    mutateHistory();
  }, [mutateHistory]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <header className="h-12 border-b border-border flex items-center px-4 flex-shrink-0 bg-background z-10 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <svg height="16" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border select-none" aria-hidden="true">/</span>
          <span className="text-sm font-medium truncate">{scriptTitle || "Blog Audio"}</span>
        </div>

        {/* URL paste input */}
        <AddPostInput mutateHistory={mutateHistory} />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setPromptEditorOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1.5 hover:bg-surface-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Prompts</span>
          </button>
        </div>
      </header>

      {/* ── Main layout: sidebar + workspace ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Fixed posts sidebar */}
        <aside className="hidden md:flex w-[320px] flex-shrink-0 border-r border-border bg-surface-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Blog Posts</span>
              <span className="text-[10px] text-muted font-mono tabular-nums">{entries.length}</span>
            </div>
            <button
              onClick={handleLoadScripts}
              disabled={loadingScripts}
              className="flex items-center gap-1.5 h-6 px-2 rounded-md bg-surface-2 border border-border text-[10px] font-medium text-muted hover:text-foreground hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
            >
              {loadingScripts ? (
                <>
                  <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>{scriptProgress.done}/{scriptProgress.total}</span>
                </>
              ) : (
                <span>Load Scripts</span>
              )}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PostsList
              entries={entries}
              selectedUrl={scriptUrl}
              activeId={activeEntry?.id ?? null}
              onSelect={handleSelectPost}
              onPlay={handlePlayFromList}
              onDelete={handleDeleteEntry}
            />
          </div>
        </aside>

        {/* Workspace: generator + voice settings side by side */}
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row overflow-hidden">

          {/* Generator panel -- fixed layout: script top, player middle, style bottom */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {!scriptUrl ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Select a blog post from the sidebar, or paste a URL above</p>
              </div>
            ) : (
              <>
                {/* Top: header + script editor (fixed) */}
                <div className="flex-shrink-0 px-5 pt-4 pb-2 flex flex-col gap-3 border-b border-border">
                  {/* Selected post header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold tracking-tight truncate">{scriptTitle || "Untitled"}</h2>
                      <a
                        href={scriptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-muted font-mono truncate block hover:text-accent transition-colors"
                      >
                        {scriptUrl}
                      </a>
                    </div>
                    <button
                      onClick={handleGenerateScript}
                      disabled={isSummarizing}
                      className="flex items-center gap-2 h-8 rounded-md bg-surface-2 border border-border text-foreground px-3 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed focus-ring flex-shrink-0"
                    >
                      {isSummarizing ? (
                        <>
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <span>{script ? "Regenerate Script" : "Generate Script"}</span>
                      )}
                    </button>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-md px-3 py-2" role="alert">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Script editor */}
                  <ScriptEditor
                    script={script}
                    title={scriptTitle}
                    isLoading={isGenerating}
                    onScriptChange={setScript}
                    onGenerate={handleGenerateAudio}
                  />
                </div>

                {/* Middle: player (scrollable area if needed) */}
                {activeEntry && (
                  <div className="flex-shrink-0 px-5 py-3 border-b border-border">
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

                {/* Bottom: style agent (fixed) */}
                <div className="flex-shrink-0 px-5 py-3 mt-auto">
                  <StyleAgent
                    sourceScript={script}
                    onUseStyledScript={setScript}
                    isGeneratingAudio={isGenerating}
                    onGenerateAudio={handleGenerateFromStyled}
                  />
                </div>
              </>
            )}
          </div>

          {/* Voice settings + versions panel */}
          <aside className="w-full lg:w-[380px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border overflow-y-auto bg-surface-1">
            <div className="p-4 flex flex-col gap-4">
              <VoiceSettings config={voiceConfig} onChange={setVoiceConfig} />

              {/* Versions list */}
              {scriptUrl && (
                <div className="border-t border-border pt-4">
                  <VersionsList
                    versions={versions}
                    activeId={activeEntry?.id ?? null}
                    onSelect={handleSelectVersion}
                    onDelete={handleDeleteVersion}
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Prompt Editor Modal */}
      <PromptEditorModal
        open={promptEditorOpen}
        onClose={() => setPromptEditorOpen(false)}
      />
    </div>
  );
}

/* ── Add Post Input (top bar) ── */

function AddPostInput({ mutateHistory }: { mutateHistory: () => void }) {
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setMessage("Invalid URL");
      return;
    }
    setIsAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/add-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUrl("");
      setMessage(`Added: ${data.title}`);
      mutateHistory();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <form onSubmit={handleAdd} className="flex-1 flex items-center gap-2 max-w-xl">
      <div className="relative flex-1">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (message) setMessage(null);
          }}
          placeholder="Paste blog URL to add..."
          disabled={isAdding}
          className="w-full h-8 rounded-md border border-border bg-surface-2 pl-8 pr-3 text-xs text-foreground font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          aria-label="Add blog post URL"
        />
      </div>
      <button
        type="submit"
        disabled={isAdding || !url.trim()}
        className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring flex-shrink-0"
      >
        {isAdding ? "Adding..." : "Add"}
      </button>
      {message && (
        <span className={`text-[11px] flex-shrink-0 ${message.startsWith("Added") ? "text-success" : "text-destructive"}`}>
          {message}
        </span>
      )}
    </form>
  );
}
