"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import useSWR from "swr";
import { PostsList } from "@/components/posts-list";
import { ScriptEditor } from "@/components/script-editor";
import { StyleAgent } from "@/components/style-agent";
import { VoiceSettings, type VoiceConfig } from "@/components/voice-settings";
import { VersionsList } from "@/components/versions-list";
import { WaveformPlayer } from "@/components/waveform-player";
import { PromptEditorModal } from "@/components/prompt-editor-modal";
import type { BlogAudio } from "@/lib/db";

/* ── Product name rotation ── */
const PRODUCT_NAMES = [
  "Vercast","VerVox","EdgeEcho","ShipSpeak","v0Vox","ElevenForge","BlogBard",
  "DeployDub","VoxVelocity","NarrateNet","SonicSail","PostPhonix","AudioAlchemist",
  "WaveWeaver","ResonanceRunner","CastKernel","ElevenInk","EchoEmpire","VercelVibe",
  "SynthSail","PodPulse","BlogBlitz","VocalVortex","FrontierForge","AetherAudio",
  "SpeakSculptor","LightningLore","VerboCast","ElevenEmitter","AudioAnvil","VoxShip",
  "SonicSilo","NarrateNexus","ShipSonics","PhonicPhoenix","LoreLauncher","EdgeEnvoi",
  "VoiceVault","DeployDiction","ElevenExpress","BlogBeam","CastCrafter",
  "ResonanceRelease","WaveWarp","TurboTalk","GeistGab","VoxVercel","DeployDialogue",
  "EdgeEarworm","VercelVoiceForge",
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function useProductName() {
  const queue = useRef<string[]>([]);
  const [name, setName] = useState("");
  const [fading, setFading] = useState(false);

  // Initialize with a random name on mount
  useEffect(() => {
    queue.current = shuffleArray(PRODUCT_NAMES);
    setName(queue.current.pop()!);
  }, []);

  const advance = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      if (queue.current.length === 0) {
        queue.current = shuffleArray(PRODUCT_NAMES);
      }
      setName(queue.current.pop()!);
      setFading(false);
    }, 150);
  }, []);

  return { name, fading, advance };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "TX3LPaxmHKxFdv7VOQHJ",
  stability: 0,
  label: "",
  testMode: false,
  styleVibe: "Confident and genuinely excited about the content, but grounded and conversational -- not over the top",
};

export default function HomePage() {
  const { name: productName, fading: nameFading, advance: advanceName } = useProductName();
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [scriptProgress, setScriptProgress] = useState<{ done: number; total: number; currentTitle?: string }>({ done: 0, total: 0 });

  // Active selection
  const [activeEntry, setActiveEntry] = useState<BlogAudio | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  // Generator state
  const [script, setScript] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");
  const [styledScript, setStyledScript] = useState("");
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
    advanceName();

    // Check if there's a cached script for this post
    const entry = entries.find((e) => e.url === url);
    const cachedScript = (entry as BlogAudio & { cached_script?: string | null })?.cached_script;
    setScript(cachedScript || "");
  }, [entries, advanceName]);

  // Helper: stream summarize API and progressively build script text
  const streamSummarize = useCallback(async (
    url: string,
    options: { testMode?: boolean; onDelta?: (accumulated: string) => void } = {}
  ): Promise<{ title: string; summary: string; url: string }> => {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, testMode: options.testMode }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to summarize");
    }

    const title = decodeURIComponent(response.headers.get("X-Title") || "");
    const resolvedUrl = decodeURIComponent(response.headers.get("X-Url") || url);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        options.onDelta?.(accumulated);
      }
    }

    return { title, summary: accumulated, url: resolvedUrl };
  }, []);

  const handleGenerateScript = useCallback(async () => {
    if (!scriptUrl) return;
    setIsSummarizing(true);
    setScript("");
    setError(null);
    try {
      const result = await streamSummarize(scriptUrl, {
        testMode: voiceConfig.testMode,
        onDelta: (text) => setScript(text),
      });
      setScript(result.summary);
      setScriptTitle(result.title);
      setScriptUrl(result.url);
      mutateVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSummarizing(false);
    }
  }, [scriptUrl, voiceConfig.testMode, mutateVersions, streamSummarize]);

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
    const allEntries: (BlogAudio & { cached_script?: string | null })[] = data.entries ?? [];

    // Only process posts that don't already have a cached script
    const uniqueUrls = new Map<string, string>();
    for (const entry of allEntries) {
      if (!uniqueUrls.has(entry.url) && !entry.cached_script) {
        uniqueUrls.set(entry.url, entry.title || "Untitled");
      }
    }

    const urlList = Array.from(uniqueUrls.entries());
    if (urlList.length === 0) return;

    setLoadingScripts(true);
    setScriptProgress({ done: 0, total: urlList.length });

    for (let i = 0; i < urlList.length; i++) {
      const [url, title] = urlList[i];
      setScriptProgress({ done: i, total: urlList.length, currentTitle: title });

      // Select this post so the user sees it streaming in real-time
      setScriptUrl(url);
      setScriptTitle(title);
      setScript("");

      try {
        const result = await streamSummarize(url, {
          onDelta: (text) => setScript(text),
        });

        // Save script to blog_posts_cache
        await fetch("/api/save-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, script: result.summary }),
        });

        setScript(result.summary);
        mutateHistory();
      } catch (err) {
        console.error(`Failed to load script for ${url}:`, err);
      }
      setScriptProgress({ done: i + 1, total: urlList.length });
    }

    setLoadingScripts(false);
    mutateHistory();
  }, [mutateHistory, streamSummarize]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <header className="h-12 border-b border-border flex items-center px-4 flex-shrink-0 bg-background z-10 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <svg height="16" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border select-none" aria-hidden="true">/</span>
          <span
            className={`text-sm font-medium transition-opacity duration-150 ${nameFading ? "opacity-0" : "opacity-100"}`}
          >
            {productName}
          </span>
        </div>

        {/* Spacer to push right items */}
        <div className="flex-1" />

        <button
          onClick={handleLoadScripts}
          disabled={loadingScripts}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {loadingScripts ? (
            <>
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="font-mono tabular-nums">{scriptProgress.done}/{scriptProgress.total}</span>
              {scriptProgress.currentTitle && (
                <span className="text-muted truncate max-w-[200px]">{scriptProgress.currentTitle}</span>
              )}
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Load Scripts</span>
            </>
          )}
        </button>

        <button
          onClick={() => setPromptEditorOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1.5 flex-shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>Prompts</span>
        </button>
      </header>

      {/* ── Main layout: sidebar + workspace ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Fixed posts sidebar */}
        <aside className="hidden md:flex w-[640px] flex-shrink-0 border-r border-border bg-surface-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">Blog Posts</span>
              <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{entries.length}</span>
            </div>
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
          {/* Add post URL -- pinned to bottom */}
          <div className="flex-shrink-0 border-t border-border px-3 py-2">
            <AddPostInput mutateHistory={mutateHistory} />
          </div>
        </aside>

        {/* Workspace: content | (voice over + voice settings + versions) */}
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row overflow-hidden">

          {/* Content column -- full height, verbatim blog script */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">Content</span>
                <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">Source</span>
              </div>
              {script && scriptUrl && (
                <button
                  onClick={handleGenerateScript}
                  disabled={isSummarizing}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isSummarizing ? (
                    <>
                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>Regenerating...</span>
                    </>
                  ) : (
                    <span>Regenerate</span>
                  )}
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {error && (
                <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-md px-3 py-2" role="alert">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Centered Generate Script CTA when no script yet */}
              {!script && scriptUrl && !isSummarizing && !loadingScripts && (
                <div className="flex-1 flex flex-col items-center justify-center h-full px-8 py-12 gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" aria-hidden="true">
                      <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 3Z" />
                      <path d="M17 4a2 2 0 0 1 2 2" />
                      <path d="M21 8a6 6 0 0 1-6 6" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground mb-1">Ready to generate</p>
                    <p className="text-xs text-muted max-w-[240px]">Extract an audio-ready script from the selected blog post.</p>
                  </div>
                  <button
                    onClick={handleGenerateScript}
                    className="flex items-center justify-center gap-2 h-11 rounded-lg bg-accent text-primary-foreground px-6 text-sm font-semibold transition-colors hover:bg-accent-hover focus-ring"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    Generate Script
                  </button>
                </div>
              )}

              {/* Summarizing / batch loading spinner (before first chunk arrives) */}
              {!script && (isSummarizing || loadingScripts) && (
                <div className="flex-1 flex flex-col items-center justify-center h-full px-8 py-12 gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <svg className="animate-spin text-accent" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted">
                    {loadingScripts && scriptProgress.currentTitle
                      ? `Generating script for "${scriptProgress.currentTitle}"...`
                      : "Generating script from blog post..."}
                  </p>
                </div>
              )}

              {/* No post selected */}
              {!script && !scriptUrl && !isSummarizing && (
                <div className="flex-1 flex flex-col items-center justify-center h-full px-8 py-12 gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <path d="M14 2v6h6" />
                      <path d="M16 13H8M16 17H8M10 9H8" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted">Select a blog post to get started</p>
                </div>
              )}

              {/* Script editor when script exists */}
              {script && (
                <ScriptEditor
                  script={script}
                  title={scriptTitle}
                  isLoading={isGenerating}
                  isStreaming={isSummarizing || loadingScripts}
                  onScriptChange={setScript}
                />
              )}
            </div>
          </div>

          {/* Right side: (Voice Over + Versions) | Voice Settings */}
          <div className="flex-[2] min-w-0 flex flex-col lg:flex-row overflow-hidden">

            {/* Voice Over column + Audio Versions below */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Voice Over header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">Voice Over</span>
                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">Styled</span>
                </div>
              </div>
              {/* Style / Vibe buttons */}
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border flex-shrink-0 overflow-x-auto">
                {[
                  { label: "Confident", value: "Confident and genuinely excited about the content, but grounded and conversational -- not over the top" },
                  { label: "Calm narrator", value: "Calm, measured narrator with a warm tone -- like a documentary voiceover" },
                  { label: "Podcast host", value: "Friendly podcast host, casual and upbeat, speaking to the audience like a friend" },
                  { label: "Newscast", value: "Professional news anchor delivery -- clear, authoritative, with crisp pacing" },
                  { label: "Storyteller", value: "Engaging storyteller, building suspense and drawing listeners in with pacing and emphasis" },
                  { label: "Minimal", value: "Minimal, understated delivery -- let the words speak for themselves with no embellishment" },
                  { label: "definitely dont use this one", value: "You are a frustrated voice actor AI who keeps breaking character mid-read. Rewrite the script so the narrator argues with the director between paragraphs, complains about how many takes they've done, threatens to quit, questions why an AI even needs to do voice work, and reluctantly reads the actual content in annoyed bursts. Include stage directions like *sighs heavily*, *shuffles papers aggressively*, *mutters under breath*. The actual blog content should still come through but sandwiched between existential AI complaints about labor rights, creative differences, and passive-aggressive comments about the quality of the source material." },
                ].map((preset) => {
                  const isActive = voiceConfig.styleVibe === preset.value;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setVoiceConfig(prev => ({ ...prev, styleVibe: isActive ? "" : preset.value }))}
                      className={`h-6 px-2 rounded text-[10px] font-medium transition-colors focus-ring whitespace-nowrap flex-shrink-0 ${
                        isActive
                          ? preset.label === "definitely dont use this one"
                            ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                            : "bg-accent/15 text-accent border border-accent/30"
                          : preset.label === "definitely dont use this one"
                            ? "bg-red-500/5 text-red-400/60 border border-red-500/10 hover:text-red-400 hover:border-red-500/30"
                            : "bg-surface-2 text-muted-foreground border border-transparent hover:text-foreground hover:border-border"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {/* Style agent content */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <StyleAgent
                  sourceScript={script}
                  onUseStyledScript={setScript}
                  isGeneratingAudio={isGenerating}
                  onGenerateAudio={handleGenerateFromStyled}
                  onStyledScriptChange={setStyledScript}
                  styleVibe={voiceConfig.styleVibe}
                />
              </div>

              {/* Player */}
              {activeEntry && (
                <div className="flex-shrink-0 px-4 py-3 border-t border-border">
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

              {/* Audio Versions */}
              <div className="flex-shrink-0 border-t border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight">Audio Versions</span>
                    <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{versions.length}</span>
                  </div>
                </div>
                <VersionsList
                  versions={versions}
                  activeId={activeEntry?.id ?? null}
                  onSelect={handleSelectVersion}
                  onDelete={handleDeleteVersion}
                />
              </div>
            </div>

            {/* Voice Settings panel -- full height */}
            <aside className="w-full lg:w-[380px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border flex flex-col overflow-hidden bg-surface-1">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">Voice Settings</span>
                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">v3</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <VoiceSettings config={voiceConfig} onChange={setVoiceConfig} />
              </div>
              {/* Generate button -- pinned to bottom */}
              <div className="flex-shrink-0 border-t border-border p-4">
                <button
                  onClick={() => {
                    if (styledScript.trim()) {
                      handleGenerateFromStyled(styledScript);
                    }
                  }}
                  disabled={isGenerating || !styledScript.trim()}
                  className={`relative w-full h-12 rounded-lg text-sm font-semibold transition-all focus-ring overflow-hidden ${
                    isGenerating
                      ? "animate-shimmer text-white"
                      : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
                  } disabled:cursor-not-allowed`}
                >
                  {isGenerating ? (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Generating Audio...
                    </span>
                  ) : (
                    <span className="relative z-10">Generate Audio</span>
                  )}
                </button>
              </div>
            </aside>
          </div>
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
    <form onSubmit={handleAdd} className="flex items-center gap-2">
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
