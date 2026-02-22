"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { PostsList } from "@/components/posts-list";
import { ScriptEditor } from "@/components/script-editor";
import { StyleAgent, type StyleHistoryEntry, type StyleAgentHandle } from "@/components/style-agent";
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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
};

type CreditsData = {
  tier: string;
  characterCount: number;
  characterLimit: number;
  nextResetUnix: number;
};

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceId: "TX3LPaxmHKxFdv7VOQHJ",
  stability: 0,
  label: "",
  styleVibe: "Confident and genuinely excited about the content, but grounded and conversational -- not over the top",
};

function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split("/").filter(Boolean).pop() || "untitled";
  } catch { return "untitled"; }
}

const SESSION_KEY = "aether-session";

function loadSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(data: Record<string, unknown>) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  );
}

function HomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { name: productName, fading: nameFading, advance: advanceName } = useProductName();
  const { data: credits, mutate: mutateCredits } = useSWR<CreditsData>("/api/credits", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const creditsPercent = credits?.characterCount != null && credits?.characterLimit
    ? Math.round((credits.characterCount / credits.characterLimit) * 100)
    : 0;
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [contentFocused, setContentFocused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "voiceover" | "settings">("content");
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
  const [generateStatus, setGenerateStatus] = useState("");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const jobPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const summarizeAbortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [styleHistory, setStyleHistory] = useState<StyleHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryScript, setSelectedHistoryScript] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const styleAgentRef = useRef<StyleAgentHandle>(null);
  const restoredRef = useRef(false);

  // Style vibe presets (from DB)
  interface VibePreset { id: number; label: string; default_prompt: string; user_prompt: string | null; }
  const { data: vibePresetsData, mutate: mutateVibePresets } = useSWR<{ presets: VibePreset[] }>("/api/style-vibe-presets", fetcher);
  const vibePresets = vibePresetsData?.presets ?? [];
  const [selectedVibeId, setSelectedVibeId] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [isVibePromptDirty, setIsVibePromptDirty] = useState(false);
  const [isSavingVibe, setIsSavingVibe] = useState(false);

  // ── Restore session on mount ──
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const s = loadSession();
    if (!s) return;
    const hasUrlParam = searchParams.get("post");
    // URL param takes priority for post identity (scriptUrl/scriptTitle/script are set by the URL restore effect below).
    // styledScript is only valid if the session's post matches the URL param post.
    if (!hasUrlParam) {
      if (s.scriptUrl) {
        setScriptUrl(s.scriptUrl);
        // Sync URL bar to match restored post
        router.replace(`?post=${encodeURIComponent(slugFromUrl(s.scriptUrl))}`, { scroll: false });
      }
      if (s.scriptTitle) setScriptTitle(s.scriptTitle);
      if (s.script) setScript(s.script);
      if (s.styledScript) setStyledScript(s.styledScript);
    } else {
      // Only restore styledScript if it belongs to the same post
      const sessionSlug = s.scriptUrl ? slugFromUrl(s.scriptUrl) : null;
      if (sessionSlug === hasUrlParam && s.styledScript) setStyledScript(s.styledScript);
    }
    if (s.activeTab) setActiveTab(s.activeTab);
    if (s.voiceConfig) setVoiceConfig({ ...DEFAULT_VOICE_CONFIG, ...s.voiceConfig });
  }, [searchParams]);

  // ── Persist session on change (debounced to avoid excessive writes) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!restoredRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSession({ scriptUrl, scriptTitle, script, styledScript, activeTab, voiceConfig, activeJobId });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [scriptUrl, scriptTitle, script, styledScript, activeTab, voiceConfig, activeJobId]);

  // Data
  const { data: historyData, mutate: mutateHistory } = useSWR<{ entries: BlogAudio[] }>("/api/history", fetcher);
  const entries = historyData?.entries ?? [];

  // ── Poll for active generation job ──
  // Use refs for SWR mutators to keep startJobPoll stable (initialized in effects below)
  const mutateHistoryRef = useRef<(() => void) | null>(null);
  const mutateVersionsRef = useRef<(() => void) | null>(null);
  const mutateCreditsRef = useRef<(() => void) | null>(null);

  const startJobPoll = useCallback((jobId: number) => {
    if (jobPollRef.current) clearInterval(jobPollRef.current);
    setIsGenerating(true);
    setActiveJobId(jobId);

    jobPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generation-jobs?jobId=${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;
        if (!job) return;

        setGenerateStatus(job.message || "Generating...");

        if (job.status === "done") {
          clearInterval(jobPollRef.current!);
          jobPollRef.current = null;
          setIsGenerating(false);
          setGenerateStatus("");
          setActiveJobId(null);
          mutateHistoryRef.current?.();
          mutateVersionsRef.current?.();
          mutateCreditsRef.current?.();
          // If the job produced an entry, auto-select it
          if (job.result_entry_id) {
            const histData = await fetch("/api/history").then((r) => r.json());
            const entry = histData.entries?.find((e: BlogAudio) => e.id === job.result_entry_id);
            if (entry) {
              setActiveEntry(entry);
              setAutoplay(true);
            }
          }
        } else if (job.status === "error") {
          clearInterval(jobPollRef.current!);
          jobPollRef.current = null;
          setIsGenerating(false);
          setGenerateStatus("");
          setActiveJobId(null);
          setError(job.message || "Generation failed");
        }
      } catch {
        // Ignore poll errors, keep trying
      }
    }, 2000);
  }, []);

  // Restore active job on mount
  useEffect(() => {
    const s = loadSession();
    if (s?.activeJobId) {
      startJobPoll(s.activeJobId);
    }
    return () => { if (jobPollRef.current) clearInterval(jobPollRef.current); };
  }, [startJobPoll]);

  // ── Restore from URL ?post=slug ──
  const urlRestoredRef = useRef(false);
  useEffect(() => {
    if (urlRestoredRef.current || entries.length === 0) return;
    const postSlug = searchParams.get("post");
    if (!postSlug) return;
    // Find matching entry by slug
    const match = entries.find((e) => slugFromUrl(e.url) === postSlug);
    if (match) {
      urlRestoredRef.current = true;
      setScriptUrl(match.url);
      setScriptTitle(match.title || "");
      const cachedScript = (match as BlogAudio & { cached_script?: string | null })?.cached_script;
      setScript(cachedScript || "");
    }
  }, [entries, searchParams]);

  const { data: versionsData, mutate: mutateVersions } = useSWR<{ versions: BlogAudio[] }>(
    scriptUrl ? `/api/versions?url=${encodeURIComponent(scriptUrl)}` : null,
    fetcher
  );
  const versions = versionsData?.versions ?? [];

  // Sync mutator refs (declared above, populated here after all SWR hooks)
  useEffect(() => { mutateHistoryRef.current = mutateHistory; }, [mutateHistory]);
  useEffect(() => { mutateVersionsRef.current = mutateVersions; }, [mutateVersions]);
  useEffect(() => { mutateCreditsRef.current = mutateCredits; }, [mutateCredits]);

  // ── Handlers ──

  const handleSelectPost = useCallback((url: string, title: string) => {
    setScriptUrl(url);
    setScriptTitle(title);
    setError(null);
    setActiveEntry(null);
    setStyledScript("");
    setSelectedHistoryScript(null);
    setAutoplay(false);
    setSidebarOpen(false);
    advanceName();

    // Push slug to URL
    const slug = slugFromUrl(url);
    router.replace(`?post=${encodeURIComponent(slug)}`, { scroll: false });

    // Check if there's a cached script for this post
    const entry = entries.find((e) => e.url === url);
    const cachedScript = (entry as BlogAudio & { cached_script?: string | null })?.cached_script;
    setScript(cachedScript || "");
  }, [entries, advanceName, router]);

  // Helper: stream summarize API and progressively build script text
  const streamSummarize = useCallback(async (
    url: string,
    options: { signal?: AbortSignal; onDelta?: (accumulated: string) => void } = {}
  ): Promise<{ title: string; summary: string; url: string }> => {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: options.signal,
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
    const abortController = new AbortController();
    summarizeAbortRef.current = abortController;
    setIsSummarizing(true);
    setScript("");
    setError(null);
    try {
      const result = await streamSummarize(scriptUrl, {
        signal: abortController.signal,
        onDelta: (text) => setScript(text),
      });
      setScript(result.summary);
      setScriptTitle(result.title);
      setScriptUrl(result.url);

      // Save to cache (same as Load Scripts)
      await fetch("/api/save-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url, script: result.summary }),
      });
      mutateVersions();
      mutateHistory();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped generation -- keep whatever text streamed so far
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    } finally {
      summarizeAbortRef.current = null;
      setIsSummarizing(false);
    }
  }, [scriptUrl, mutateVersions, mutateHistory, streamSummarize]);

  const handleGenerateFromStyled = useCallback(async (styledScript: string) => {
    if (!styledScript.trim() || !scriptUrl || isGenerating) return;
    setIsGenerating(true);
    setGenerateStatus("Starting generation...");
    setError(null);
    try {
      const payload = {
        url: scriptUrl,
        title: scriptTitle,
        summary: styledScript,
        voiceId: voiceConfig.voiceId,
        stability: voiceConfig.stability,
      };
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = "Failed to generate audio";
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch { /* response may not be JSON */ }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalEntry = null;
      let jobId: number | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === "job") {
                jobId = event.jobId;
                setActiveJobId(jobId);
              } else if (event.type === "status") {
                setGenerateStatus(event.message);
              } else if (event.type === "done") {
                finalEntry = event.entry;
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      }

      if (finalEntry) {
      setActiveEntry(finalEntry);
      setAutoplay(true);
      mutateHistory();
      mutateVersions();
      mutateCredits();
      }
      setActiveJobId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsGenerating(false);
      setGenerateStatus("");
      setActiveJobId(null);
    }
  }, [scriptUrl, scriptTitle, voiceConfig, mutateHistory, mutateVersions, mutateCredits, isGenerating]);

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
  if (window.innerWidth < 768) setSidebarOpen(false);
  setScriptUrl(entry.url);
  setScriptTitle(entry.title || "");
  // Use cached_script (original content script) if available, not summary (which is the styled/audio script)
  const cachedScript = (entry as BlogAudio & { cached_script?: string | null })?.cached_script;
  setScript(cachedScript || entry.summary || "");
  router.replace(`?post=${encodeURIComponent(slugFromUrl(entry.url))}`, { scroll: false });
  }, [router]);

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

  // ── Vibe preset handlers ──
  const handleSelectVibe = useCallback((preset: { id: number; label: string; default_prompt: string; user_prompt: string | null }) => {
    if (selectedVibeId === preset.id) {
      // Deselect
      setSelectedVibeId(null);
      setEditedPrompt("");
      setIsVibePromptDirty(false);
      setVoiceConfig(prev => ({ ...prev, styleVibe: "" }));
    } else {
      const prompt = preset.user_prompt ?? preset.default_prompt;
      setSelectedVibeId(preset.id);
      setEditedPrompt(prompt);
      setIsVibePromptDirty(false);
      setVoiceConfig(prev => ({ ...prev, styleVibe: prompt }));
    }
  }, [selectedVibeId]);

  const handleVibePromptChange = useCallback((value: string) => {
    setEditedPrompt(value);
    setIsVibePromptDirty(true);
    setVoiceConfig(prev => ({ ...prev, styleVibe: value }));
  }, []);

  const handleSaveVibePrompt = useCallback(async () => {
    if (!selectedVibeId || !isVibePromptDirty) return;
    setIsSavingVibe(true);
    try {
      await fetch("/api/style-vibe-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedVibeId, userPrompt: editedPrompt }),
      });
      setIsVibePromptDirty(false);
      mutateVibePresets();
    } catch { /* ignore */ } finally {
      setIsSavingVibe(false);
    }
  }, [selectedVibeId, isVibePromptDirty, editedPrompt, mutateVibePresets]);

  const handleResetVibePrompt = useCallback(async () => {
    if (!selectedVibeId) return;
    const preset = vibePresets.find(p => p.id === selectedVibeId);
    if (!preset) return;
    setIsSavingVibe(true);
    try {
      await fetch("/api/style-vibe-presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedVibeId }),
      });
      setEditedPrompt(preset.default_prompt);
      setIsVibePromptDirty(false);
      setVoiceConfig(prev => ({ ...prev, styleVibe: preset.default_prompt }));
      mutateVibePresets();
    } catch { /* ignore */ } finally {
      setIsSavingVibe(false);
    }
  }, [selectedVibeId, vibePresets, mutateVibePresets]);

  const handleStopGenerating = useCallback(() => {
    summarizeAbortRef.current?.abort();
  }, []);

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

    const abortController = new AbortController();
    summarizeAbortRef.current = abortController;
    setLoadingScripts(true);
    setScriptProgress({ done: 0, total: urlList.length });

    for (let i = 0; i < urlList.length; i++) {
      if (abortController.signal.aborted) break;
      const [url, title] = urlList[i];
      setScriptProgress({ done: i, total: urlList.length, currentTitle: title });

      // Select this post so the user sees it streaming in real-time
      setScriptUrl(url);
      setScriptTitle(title);
      setScript("");

      try {
        const result = await streamSummarize(url, {
          signal: abortController.signal,
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
        if (err instanceof DOMException && err.name === "AbortError") break;
        console.error(`Failed to load script for ${url}:`, err);
      }
      setScriptProgress({ done: i + 1, total: urlList.length });
    }

    summarizeAbortRef.current = null;
    setLoadingScripts(false);
    mutateHistory();
  }, [mutateHistory, streamSummarize]);

  return (
    <div className="h-screen flex flex-col overflow-hidden min-w-[320px]">
      {/* ── Top bar ── */}
      <header className="h-12 border-b border-border flex items-center px-3 sm:px-4 flex-shrink-0 bg-background z-10 gap-2 sm:gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex items-center justify-center w-11 h-11 -ml-1.5 rounded-md text-muted hover:text-foreground transition-colors focus-ring flex-shrink-0"
          aria-label="Open blog posts"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        <div className="flex items-center gap-3 flex-shrink-0">
          <svg height="16" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border select-none" aria-hidden="true">/</span>
          <span
            className={`text-sm font-medium transition-opacity duration-150 hidden sm:inline ${nameFading ? "opacity-0" : "opacity-100"}`}
          >
            {productName}
          </span>
        </div>

        {/* Spacer to push right items */}
        <div className="flex-1" />

        {loadingScripts ? (
          <button
            onClick={handleStopGenerating}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors focus-ring rounded px-2 py-1.5 flex-shrink-0"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            <span className="hidden sm:inline">Stop</span>
            <span>({scriptProgress.done}/{scriptProgress.total})</span>
          </button>
        ) : (
          <button
            onClick={handleLoadScripts}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1.5 flex-shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span className="hidden sm:inline">Load Scripts</span>
          </button>
        )}

        <button
          onClick={() => setPromptEditorOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1.5 flex-shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span className="hidden sm:inline">Prompts</span>
        </button>

        {/* Credits */}
        {credits && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-1">
            <div className="w-16 sm:w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  creditsPercent > 90 ? "bg-red-500" : creditsPercent > 70 ? "bg-amber-500" : "bg-accent"
                }`}
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-muted font-mono tabular-nums hidden sm:inline">
              {(credits.characterCount ?? 0).toLocaleString()}/{(credits.characterLimit ?? 0).toLocaleString()}
            </span>
          </div>
        )}
      </header>

      {/* ── Mobile sidebar drawer ── */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-[85vw] max-w-[400px] z-50 md:hidden bg-surface-1 border-r border-border flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">Blog Posts</span>
                <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{entries.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <AddPostButton mutateHistory={mutateHistory} />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center justify-center w-11 h-11 text-muted hover:text-foreground transition-colors focus-ring rounded"
                  aria-label="Close sidebar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
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

            {/* Versions */}
            <div className="flex-shrink-0 border-t border-border">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">Versions</span>
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

          </aside>
        </>
      )}

      {/* ── Mobile tab bar ── */}
      <div className="flex md:hidden border-b border-border flex-shrink-0 bg-background">
        {([
          { id: "content" as const, label: "Content" },
          { id: "voiceover" as const, label: "Voice Over" },
          { id: "settings" as const, label: "Settings" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
              activeTab === tab.id
                ? "text-foreground border-b-2 border-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main layout: sidebar + workspace ── */}
      <div className={`flex-1 flex overflow-hidden ${activeEntry?.audio_url ? "md:pb-0 pb-[180px]" : ""}`}>

        {/* Fixed posts sidebar -- desktop */}
        <aside className="hidden md:flex md:flex-1 min-w-0 border-r border-border bg-surface-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">Blog Posts</span>
              <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{entries.length}</span>
            </div>
            <AddPostButton mutateHistory={mutateHistory} />
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

          {/* Versions */}
          <div className="flex-shrink-0 border-t border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">Versions</span>
                <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{versions.length}</span>
              </div>
            </div>
            {isGenerating && generateStatus && (
              <div className="px-3 py-1.5 border-b border-border bg-accent/5">
                <p className="text-[10px] text-accent font-mono truncate animate-pulse">
                  {generateStatus}
                </p>
              </div>
            )}
            <VersionsList
              versions={versions}
              activeId={activeEntry?.id ?? null}
              onSelect={handleSelectVersion}
              onDelete={handleDeleteVersion}
            />
          </div>

          {/* Player -- always visible */}
          <div className="flex-shrink-0 border-t border-border">
            <WaveformPlayer
              key={activeEntry?.id ?? "idle"}
              audioUrl={activeEntry?.audio_url}
              title={activeEntry?.title || undefined}
              summary={activeEntry?.summary || undefined}
              url={activeEntry?.url}
              autoplay={autoplay}
            />
          </div>
        </aside>

        {/* Workspace: content | (voice over + voice settings + versions) */}
        <div className="flex-[3] min-w-0 flex flex-col xl:flex-row overflow-hidden">

          {/* Content column -- full height, verbatim blog script */}
          <div
            className={`flex-1 min-w-0 flex-col overflow-hidden border-r border-border ${activeTab === "content" ? "flex" : "hidden md:flex"}`}
            onMouseEnter={() => setContentFocused(true)}
            onMouseLeave={() => setContentFocused(false)}
            onFocus={() => setContentFocused(true)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setContentFocused(false); }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">Content</span>
                <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">Source</span>
              </div>
              {script && scriptUrl && !isSummarizing && !loadingScripts && (
              <button
                onClick={handleGenerateScript}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1 flex-shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                <span>Regenerate</span>
              </button>
              )}
              {(isSummarizing || loadingScripts) && (
              <button
                onClick={handleStopGenerating}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors focus-ring rounded px-2 py-1 flex-shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                <span>Stop</span>
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
              <button
                onClick={handleStopGenerating}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors focus-ring rounded px-2.5 py-1.5 border border-red-500/20 hover:border-red-500/40"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                <span>Stop generating</span>
              </button>
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
                  isStyled={!!styledScript.trim()}
                  onScriptChange={setScript}
                />
              )}
            </div>
          </div>

          {/* Right side: (Voice Over + Versions) | Voice Settings */}
          <div className={`flex-[2] min-w-0 flex-col xl:flex-row overflow-hidden ${activeTab !== "content" ? "flex" : "hidden md:flex"}`}>

            {/* Voice Over column + Versions below */}
            <div className={`flex-1 min-w-0 flex-col overflow-hidden ${activeTab === "voiceover" ? "flex" : "hidden md:flex"}`}>
              {/* Voice Over header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">Voice Over</span>
                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">Styled</span>
                </div>
                {/* History dropdown */}
                <div className="relative" ref={historyRef}>
                  <button
                    onClick={() => setHistoryOpen(prev => !prev)}
                    className={`flex items-center gap-1.5 text-xs transition-colors focus-ring rounded px-2 py-1 ${
                      styleHistory.length > 0
                        ? "text-muted hover:text-foreground"
                        : "text-muted/40 cursor-default"
                    }`}
                    disabled={styleHistory.length === 0}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>History</span>
                    {styleHistory.length > 0 && (
                      <span className="text-[10px] font-mono text-accent bg-accent/10 px-1 py-0.5 rounded">{styleHistory.length}</span>
                    )}
                  </button>
                  {historyOpen && styleHistory.length > 0 && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-40" onClick={() => setHistoryOpen(false)} />
                      {/* Dropdown */}
                      <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-1 shadow-lg">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-[11px] font-medium text-muted">Previous Generations</p>
                        </div>
                        {styleHistory.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => {
                              setSelectedHistoryScript(entry.script);
                              setStyledScript(entry.script);
                              setHistoryOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors border-b border-border last:border-b-0 group"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded truncate max-w-[160px]">
                                {entry.vibe.length > 30 ? entry.vibe.slice(0, 30) + "..." : entry.vibe}
                              </span>
                              <span className="text-[10px] text-muted font-mono tabular-nums flex-shrink-0">
                                {entry.wordCount}w
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {entry.script.slice(0, 120)}...
                            </p>
                            <p className="text-[10px] text-muted mt-1">
                              {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Vibe preset grid */}
              <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5 px-3 py-2 border-b border-border flex-shrink-0">
                {vibePresets.map((preset) => {
                  const isActive = selectedVibeId === preset.id;
                  const isDanger = preset.label === "Chaos mode";
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectVibe(preset)}
                      className={`h-8 px-2 rounded text-[11px] font-medium transition-colors focus-ring truncate ${
                        isActive
                          ? isDanger
                            ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                            : "bg-accent/15 text-accent border border-accent/30"
                          : isDanger
                            ? "bg-red-500/5 text-red-400/60 border border-red-500/10 hover:text-red-400 hover:border-red-500/30"
                            : "bg-surface-2 text-muted-foreground border border-transparent hover:text-foreground hover:border-border"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Editable prompt */}
              {selectedVibeId && (
                <div className="flex-shrink-0 border-b border-border px-3 py-2 flex flex-col gap-2">
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => handleVibePromptChange(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-2 text-sm text-foreground rounded-md border border-border px-3 py-2 resize-none focus:outline-none focus:border-accent transition-colors"
                    placeholder="Describe the voice style..."
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleResetVibePrompt}
                      disabled={isSavingVibe}
                      className="h-7 px-3 rounded text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-colors focus-ring disabled:opacity-40"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleSaveVibePrompt}
                      disabled={!isVibePromptDirty || isSavingVibe}
                      className="h-7 px-3 rounded text-xs font-medium bg-accent text-primary-foreground hover:bg-accent-hover transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSavingVibe ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {/* Style Script button */}
              <div className="flex-shrink-0 px-3 py-2 border-b border-border flex justify-center">
                <button
                  onClick={() => styleAgentRef.current?.runAgent()}
                  disabled={styleAgentRef.current?.isRunning || !script.trim()}
                  className="flex items-center justify-center gap-2 h-8 rounded-md bg-accent text-primary-foreground px-5 text-xs font-medium transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
                >
                  {styleAgentRef.current?.isRunning ? (
                    <>
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>Styling...</span>
                    </>
                  ) : (
                    <span>Style Script</span>
                  )}
                </button>
              </div>

              {/* Style agent output */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <StyleAgent
                  ref={styleAgentRef}
                  sourceScript={script}
                  postUrl={scriptUrl}
                  onUseStyledScript={setScript}
                  isGeneratingAudio={isGenerating}
                  onGenerateAudio={handleGenerateFromStyled}
                  onStyledScriptChange={setStyledScript}
                  onHistoryChange={setStyleHistory}
                  externalScript={selectedHistoryScript}
                  styleVibe={voiceConfig.styleVibe}
                  dimmed={contentFocused}
                />
              </div>

              {/* Generate Audio button */}
              <div className="flex-shrink-0 px-3 py-2 border-t border-border flex justify-center">
                <button
                  onClick={() => { if (styledScript.trim()) handleGenerateFromStyled(styledScript); }}
                  disabled={isGenerating || !styledScript.trim()}
                  className="flex items-center justify-center gap-2 h-8 rounded-md bg-foreground text-background px-5 text-xs font-medium transition-colors hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>{generateStatus || "Generating..."}</span>
                    </>
                  ) : (
                    <span>Generate Audio</span>
                  )}
                </button>
              </div>
            </div>

            {/* Voice Settings panel -- full height */}
            <aside className={`w-full xl:flex-1 min-w-0 border-t xl:border-t-0 xl:border-l border-border flex-col overflow-hidden bg-surface-1 ${activeTab === "settings" ? "flex" : "hidden md:flex"}`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight">Voice Settings</span>
                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">v3</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <VoiceSettings config={voiceConfig} onChange={setVoiceConfig} isGenerating={isGenerating} generateStatus={generateStatus} />
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

      {/* Mobile fixed-bottom player (hidden on md+ where desktop sidebar player exists) */}
      {activeEntry?.audio_url && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background">
          <WaveformPlayer
            key={`mobile-${activeEntry.id}`}
            audioUrl={activeEntry.audio_url}
            title={activeEntry.title || undefined}
            summary={activeEntry.summary || undefined}
            url={activeEntry.url}
            autoplay={autoplay}
          />
        </div>
      )}
    </div>
  );
}

/* ── Add Post Button (popup) ── */

function AddPostButton({ mutateHistory }: { mutateHistory: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

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
      setTimeout(() => { setMessage(null); setOpen(false); }, 1500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-muted hover:text-foreground transition-colors focus-ring rounded"
        aria-label="Add blog post"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border border-border bg-surface-1 shadow-lg p-3">
          <form onSubmit={handleAdd} className="flex flex-col gap-2">
            <label className="text-[11px] text-muted font-medium">Blog Post URL</label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (message) setMessage(null);
                }}
                placeholder="https://vercel.com/blog/..."
                disabled={isAdding}
                className="flex-1 h-8 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                aria-label="Blog post URL"
              />
              <button
                type="submit"
                disabled={isAdding || !url.trim()}
                className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring flex-shrink-0"
              >
                {isAdding ? "..." : "Add"}
              </button>
            </div>
            {message && (
              <span className={`text-[11px] ${message.startsWith("Added") ? "text-success" : "text-destructive"}`}>
                {message}
              </span>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
