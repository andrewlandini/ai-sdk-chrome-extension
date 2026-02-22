"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { formatDateTime } from "@/lib/timezone";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MODELS = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4.1", label: "GPT-4.1" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
] as const;

// Pipeline order
const PIPELINE_SLUGS = ["blog_fetcher", "script_generator", "style_agent"] as const;

interface PromptNode {
  id: number;
  slug: string;
  label: string;
  default_prompt: string;
  user_prompt: string | null;
  model: string;
  default_model: string;
  updated_at: string;
}

interface HistoryEntry {
  id: number;
  node_slug: string;
  prompt: string;
  model: string;
  changed_at: string;
}

interface PromptEditorModalProps {
  open: boolean;
  onClose: () => void;
}

export function PromptEditorModal({ open, onClose }: PromptEditorModalProps) {
  const { data: nodes, mutate } = useSWR<PromptNode[]>(
    open ? "/api/prompt-nodes" : null,
    fetcher
  );

  const [selectedSlug, setSelectedSlug] = useState<string>(PIPELINE_SLUGS[0]);
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedNode = nodes?.find((n) => n.slug === selectedSlug) ?? null;

  // Sync editor state when selection or data changes
  useEffect(() => {
    if (selectedNode) {
      const prompt = selectedNode.user_prompt ?? selectedNode.default_prompt;
      setEditPrompt(prompt);
      setEditModel(selectedNode.model);
      setIsDirty(false);
      setShowHistory(false);
    }
  }, [selectedNode?.slug, selectedNode?.updated_at]);

  const activePrompt = selectedNode?.user_prompt ?? selectedNode?.default_prompt ?? "";
  const isOverridden = selectedNode?.user_prompt !== null && selectedNode?.user_prompt !== undefined;

  const handlePromptChange = useCallback((value: string) => {
    setEditPrompt(value);
    setIsDirty(true);
  }, []);

  const handleModelChange = useCallback((value: string) => {
    setEditModel(value);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedSlug || !isDirty) return;
    setIsSaving(true);
    try {
      await fetch("/api/prompt-nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedSlug,
          user_prompt: editPrompt,
          model: editModel,
        }),
      });
      await mutate();
      setIsDirty(false);
    } catch (e) {
      console.error("Failed to save prompt node:", e);
    } finally {
      setIsSaving(false);
    }
  }, [selectedSlug, editPrompt, editModel, isDirty, mutate]);

  const handleReset = useCallback(async () => {
    if (!selectedSlug) return;
    setIsSaving(true);
    try {
      await fetch("/api/prompt-nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, reset: true }),
      });
      await mutate();
      setIsDirty(false);
    } catch (e) {
      console.error("Failed to reset prompt node:", e);
    } finally {
      setIsSaving(false);
    }
  }, [selectedSlug, mutate]);

  const loadHistory = useCallback(async () => {
    if (!selectedSlug) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/prompt-nodes?slug=${selectedSlug}&history=1`);
      const data = await res.json();
      setHistory(data);
      setShowHistory(true);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedSlug]);

  const restoreFromHistory = useCallback((entry: HistoryEntry) => {
    setEditPrompt(entry.prompt);
    setEditModel(entry.model);
    setIsDirty(true);
    setShowHistory(false);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl h-[85vh] bg-surface-1 border border-border rounded-xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Prompt Pipeline</h2>
            <span className="text-xs text-muted-foreground">Click a node to edit</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors focus-ring"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pipeline flow */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-center gap-0">
            {PIPELINE_SLUGS.map((slug, i) => {
              const node = nodes?.find((n) => n.slug === slug);
              const isSelected = selectedSlug === slug;
              const hasOverride = node?.user_prompt !== null && node?.user_prompt !== undefined;
              return (
                <div key={slug} className="flex items-center">
                  {i > 0 && (
                    <div className="flex items-center px-2">
                      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" aria-hidden="true">
                        <path d="M0 6h16M13 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-border" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedSlug(slug)}
                    className={`relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg border transition-all focus-ring ${
                      isSelected
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border bg-surface-2 text-muted-foreground hover:border-border-hover hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs font-medium whitespace-nowrap">{node?.label ?? slug}</span>
                    <span className="text-[10px] text-muted-foreground">{node?.model ?? "..."}</span>
                    {hasOverride && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warning" title="Custom override" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {selectedNode ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{selectedNode.label}</span>
                  {isOverridden && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
                      Custom
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => showHistory ? setShowHistory(false) : loadHistory()}
                    disabled={loadingHistory}
                    className={`h-7 px-3 rounded text-xs font-medium transition-colors focus-ring ${
                      showHistory
                        ? "bg-surface-3 text-foreground"
                        : "text-muted-foreground border border-border hover:text-foreground hover:border-border-hover"
                    } disabled:opacity-40`}
                  >
                    {loadingHistory ? "Loading..." : "History"}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isSaving || !isOverridden}
                    className="h-7 px-3 rounded text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-border-hover transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reset to Default
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="h-7 px-3 rounded text-xs font-medium bg-accent text-primary-foreground hover:bg-accent-hover transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {/* Model selector */}
              <div className="flex items-center gap-2 px-5 py-2 border-b border-border flex-shrink-0 overflow-x-auto">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0">Model</span>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelChange(m.id)}
                    className={`h-6 px-2 rounded text-[10px] font-medium transition-colors whitespace-nowrap focus-ring ${
                      editModel === m.id
                        ? "bg-accent text-primary-foreground"
                        : "bg-surface-2 text-muted-foreground border border-border hover:text-foreground hover:border-border-hover"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Content area */}
              <div className="flex-1 min-h-0 flex">
                {/* Prompt textarea */}
                <div className={`flex-1 min-h-0 flex flex-col ${showHistory ? "border-r border-border" : ""}`}>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    className="flex-1 min-h-0 w-full bg-background text-sm text-foreground px-5 py-4 resize-none focus:outline-none font-mono leading-relaxed"
                    placeholder="Enter prompt..."
                    spellCheck={false}
                  />
                  {/* Placeholder hint for Style Agent */}
                  {selectedNode?.slug === "style_agent" && editPrompt.includes("{{STYLE_CUE}}") && (
                    <div className="flex-shrink-0 px-5 py-2 border-t border-border bg-surface-2">
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-mono text-accent">{"{{STYLE_CUE}}"}</span>
                        {" "}is replaced at runtime with the vibe you select (Confident, Calm, Podcast, Chaos). You can move it within the prompt or remove it.
                      </p>
                    </div>
                  )}
                  {/* Default prompt preview when overridden */}
                  {isOverridden && !showHistory && (
                    <div className="flex-shrink-0 border-t border-border">
                      <button
                        onClick={() => setEditPrompt(selectedNode.default_prompt)}
                        className="w-full text-left px-5 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="font-medium">Default prompt:</span>{" "}
                        {selectedNode.default_prompt.slice(0, 120)}...
                        <span className="ml-2 underline">Click to view</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* History panel */}
                {showHistory && (
                  <div className="w-72 flex-shrink-0 flex flex-col min-h-0 bg-surface-1">
                    <div className="px-3 py-2 border-b border-border flex-shrink-0">
                      <span className="text-xs font-medium text-foreground">Edit History</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {history.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-muted-foreground text-center">No history yet</p>
                      ) : (
                        history.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => restoreFromHistory(entry)}
                            className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-surface-2 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDateTime(entry.changed_at)}
                              </span>
                              <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                Restore
                              </span>
                            </div>
                            <p className="text-xs text-foreground/70 line-clamp-2">
                              {entry.prompt.slice(0, 100) || "(empty)"}
                            </p>
                            <span className="text-[10px] text-muted-foreground mt-0.5 block">{entry.model}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {nodes ? "Select a node above" : "Loading..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
