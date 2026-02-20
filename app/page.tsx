"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { LibraryView } from "@/components/library-view";
import { GeneratorView } from "@/components/generator-view";
import { PromptEditorModal } from "@/components/prompt-editor-modal";
import type { BlogAudio } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type View = "library" | "generator";

export default function HomePage() {
  const [view, setView] = useState<View>("generator");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  // Shared state for active playback
  const [activeEntry, setActiveEntry] = useState<BlogAudio | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  // Generator-specific script state
  const [script, setScript] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");

  const { data: historyData, mutate: mutateHistory } = useSWR<{
    entries: BlogAudio[];
  }>("/api/history", fetcher);

  const entries = historyData?.entries ?? [];

  const handlePlayFromLibrary = useCallback((entry: BlogAudio) => {
    setActiveEntry(entry);
    setAutoplay(true);
  }, []);

  const handleOpenInGenerator = useCallback((entry: BlogAudio) => {
    setScript(entry.summary || "");
    setScriptTitle(entry.title || "");
    setScriptUrl(entry.url);
    setActiveEntry(entry);
    setAutoplay(true);
    setView("generator");
  }, []);

  const handleDeleteEntry = useCallback(
    async (entry: BlogAudio) => {
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
    },
    [activeEntry, mutateHistory]
  );

  const NAV_ITEMS = [
    {
      id: "generator" as View,
      label: "Generator",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 3Z" />
          <path d="M17 4a2 2 0 0 1 2 2" />
          <path d="M21 8a6 6 0 0 1-6 6" />
        </svg>
      ),
    },
    {
      id: "library" as View,
      label: "Library",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      badge: entries.length > 0 ? entries.length : undefined,
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <header className="h-12 border-b border-border flex items-center px-4 flex-shrink-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <svg height="16" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-border select-none" aria-hidden="true">/</span>
          {!sidebarCollapsed && (
            <span className="text-sm font-medium">Blog Audio</span>
          )}
          {sidebarCollapsed && (
            <span className="text-sm font-medium">Blog Audio Generator</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setPromptEditorOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors focus-ring rounded px-2 py-1.5 hover:bg-surface-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span className="hidden sm:inline">Prompts</span>
          </button>
          <span className="text-xs text-muted font-mono tabular-nums px-2">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar ── */}
        <nav
          className={`flex-shrink-0 border-r border-border bg-surface-1 flex flex-col transition-all duration-200 ${
            sidebarCollapsed ? "w-[52px]" : "w-[200px]"
          }`}
        >
          <div className="flex-1 py-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-colors focus-ring ${
                  view === item.id
                    ? "text-foreground bg-surface-3"
                    : "text-muted hover:text-foreground hover:bg-surface-2"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[10px] font-mono tabular-nums text-muted bg-surface-3 px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Collapse toggle */}
          <div className="border-t border-border p-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-2 text-muted hover:text-foreground transition-colors rounded hover:bg-surface-2 focus-ring"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
              </svg>
            </button>
          </div>
        </nav>

        {/* ── Main content area ── */}
        <main className="flex-1 overflow-hidden">
          {view === "library" && (
            <LibraryView
              entries={entries}
              activeId={activeEntry?.id ?? null}
              onPlay={handlePlayFromLibrary}
              onOpenInGenerator={handleOpenInGenerator}
              onDelete={handleDeleteEntry}
              mutateHistory={mutateHistory}
            />
          )}
          {view === "generator" && (
            <GeneratorView
              script={script}
              scriptTitle={scriptTitle}
              scriptUrl={scriptUrl}
              activeEntry={activeEntry}
              autoplay={autoplay}
              onScriptChange={setScript}
              onScriptTitleChange={setScriptTitle}
              onScriptUrlChange={setScriptUrl}
              onActiveEntryChange={setActiveEntry}
              onAutoplayChange={setAutoplay}
              mutateHistory={mutateHistory}
            />
          )}
        </main>
      </div>

      {/* Prompt Editor Modal */}
      <PromptEditorModal
        open={promptEditorOpen}
        onClose={() => setPromptEditorOpen(false)}
      />
    </div>
  );
}
