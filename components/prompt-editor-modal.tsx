"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MODELS = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", provider: "Anthropic", tier: "top" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4", provider: "Anthropic", tier: "top" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", tier: "top" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", tier: "fast" },
  { id: "openai/gpt-4.1", label: "GPT-4.1", provider: "OpenAI", tier: "top" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "OpenAI", tier: "fast" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", tier: "top" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", tier: "fast" },
] as const;

const PROMPT_TABS = [
  { id: "system", label: "Script Prompt" },
  { id: "test", label: "Test Prompt" },
  { id: "blog", label: "Blog Fetch Prompt" },
] as const;

type PromptTab = (typeof PROMPT_TABS)[number]["id"];

const DEFAULT_BLOG_FETCH_PROMPT = `You are an expert web content parser. Extract ALL blog post entries from this page content.

For each blog post, extract:
- "url": the full URL (must start with https://vercel.com/blog/)
- "title": the post title
- "description": a short description/subtitle if available, otherwise null
- "date": publication date if visible, otherwise null
- "category": category/tag if visible (e.g. "Engineering", "Product", "Customers"), otherwise null

RULES:
1. Only include actual blog post links, NOT navigation, footer, category filter, or pagination links
2. Extract EVERY post visible on the page - do not skip any
3. URLs may be relative (e.g. /blog/some-post) - convert them to full URLs (https://vercel.com/blog/some-post)
4. Return ONLY a valid JSON array, no markdown fences, no explanation
5. If you see a title with a date and/or category next to it, that is a blog post entry
6. Look for patterns like article titles followed by dates, author names, and category labels

Example:
[{"url":"https://vercel.com/blog/example","title":"Example Post","description":"A description","date":"Feb 14, 2026","category":"Engineering"}]`;

interface PromptPreset {
  id: number;
  name: string;
  system_prompt: string;
  test_prompt: string;
  blog_fetch_prompt: string | null;
  model: string;
  is_default: boolean;
  created_at: string;
}

interface PromptEditorModalProps {
  open: boolean;
  onClose: () => void;
}

export function PromptEditorModal({ open, onClose }: PromptEditorModalProps) {
  const { data, mutate } = useSWR<{ presets: PromptPreset[] }>(
    open ? "/api/prompt-presets" : null,
    fetcher
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [testPrompt, setTestPrompt] = useState("");
  const [blogFetchPrompt, setBlogFetchPrompt] = useState(DEFAULT_BLOG_FETCH_PROMPT);
  const [model, setModel] = useState("openai/gpt-4o");
  const [activeTab, setActiveTab] = useState<PromptTab>("system");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const presets = data?.presets ?? [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (presets.length > 0 && selectedId === null) {
      const def = presets.find((p) => p.is_default) || presets[0];
      setSelectedId(def.id);
      setName(def.name);
      setSystemPrompt(def.system_prompt);
      setTestPrompt(def.test_prompt);
      setBlogFetchPrompt(def.blog_fetch_prompt || DEFAULT_BLOG_FETCH_PROMPT);
      setModel(def.model || "openai/gpt-4o");
    }
  }, [presets, selectedId]);

  const handleSelectPreset = useCallback((preset: PromptPreset) => {
    setSelectedId(preset.id);
    setName(preset.name);
    setSystemPrompt(preset.system_prompt);
    setTestPrompt(preset.test_prompt);
    setBlogFetchPrompt(preset.blog_fetch_prompt || DEFAULT_BLOG_FETCH_PROMPT);
    setModel(preset.model || "openai/gpt-4o");
    setMessage(null);
  }, []);

  const getPayload = useCallback(() => ({
    name,
    system_prompt: systemPrompt,
    test_prompt: testPrompt,
    blog_fetch_prompt: blogFetchPrompt,
    model,
  }), [name, systemPrompt, testPrompt, blogFetchPrompt, model]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !systemPrompt.trim() || !testPrompt.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      if (selectedId) {
        await fetch("/api/prompt-presets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedId, ...getPayload() }),
        });
        setMessage("Preset updated");
      } else {
        const res = await fetch("/api/prompt-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getPayload()),
        });
        const data = await res.json();
        setSelectedId(data.preset.id);
        setMessage("Preset created");
      }
      mutate();
    } catch {
      setMessage("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [selectedId, name, systemPrompt, testPrompt, getPayload, mutate]);

  const handleSaveAsNew = useCallback(async () => {
    if (!name.trim() || !systemPrompt.trim() || !testPrompt.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/prompt-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...getPayload(), name: name + " (copy)" }),
      });
      const data = await res.json();
      setSelectedId(data.preset.id);
      setName(data.preset.name);
      setMessage("Created as new preset");
      mutate();
    } catch {
      setMessage("Failed to create");
    } finally {
      setIsSaving(false);
    }
  }, [name, systemPrompt, testPrompt, getPayload, mutate]);

  const handleSetDefault = useCallback(async () => {
    if (!selectedId) return;
    try {
      await fetch("/api/prompt-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, setDefault: true }),
      });
      setMessage("Set as default");
      mutate();
    } catch {
      setMessage("Failed to set default");
    }
  }, [selectedId, mutate]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    const preset = presets.find((p) => p.id === selectedId);
    if (preset?.is_default) {
      setMessage("Cannot delete the default preset");
      return;
    }
    try {
      await fetch("/api/prompt-presets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId }),
      });
      setSelectedId(null);
      setMessage("Preset deleted");
      mutate();
    } catch {
      setMessage("Failed to delete");
    }
  }, [selectedId, presets, mutate]);

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setName("");
    setSystemPrompt("");
    setTestPrompt("");
    setBlogFetchPrompt(DEFAULT_BLOG_FETCH_PROMPT);
    setModel("openai/gpt-4o");
    setMessage(null);
  }, []);

  const activePreset = presets.find((p) => p.id === selectedId);
  const isDefault = activePreset?.is_default ?? false;
  const selectedModelInfo = MODELS.find((m) => m.id === model);

  // Get current tab content
  const currentPromptValue = activeTab === "system" ? systemPrompt : activeTab === "test" ? testPrompt : blogFetchPrompt;
  const currentPromptSetter = activeTab === "system" ? setSystemPrompt : activeTab === "test" ? setTestPrompt : setBlogFetchPrompt;
  const currentPromptPlaceholder = activeTab === "system"
    ? "The main system prompt used when generating the full script from a blog post..."
    : activeTab === "test"
    ? "A shorter prompt used in test mode to save ElevenLabs credits..."
    : "The prompt used by the AI agent when parsing blog listing pages to discover posts...";
  const currentPromptRows = activeTab === "blog" ? 14 : activeTab === "system" ? 12 : 5;

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-full max-w-full bg-transparent p-0 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-center min-h-full p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-4xl bg-surface-1 border border-border rounded-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h2 className="text-base font-semibold">Prompt Editor</h2>
              {selectedModelInfo && (
                <span className="text-xs text-muted font-mono bg-surface-2 px-2 py-0.5 rounded">
                  {selectedModelInfo.label}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors focus-ring" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col lg:flex-row">
              {/* Preset sidebar */}
              <div className="lg:w-[200px] border-b lg:border-b-0 lg:border-r border-border flex-shrink-0">
                <div className="px-3 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted uppercase tracking-wider">Presets</span>
                  <button onClick={handleNew} className="text-xs text-accent hover:text-accent/80 transition-colors focus-ring rounded px-1">
                    + New
                  </button>
                </div>
                <div className="px-2 pb-2 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors focus-ring flex-shrink-0 ${
                        selectedId === preset.id
                          ? "bg-surface-3 text-foreground"
                          : "text-muted hover:text-foreground hover:bg-surface-2"
                      }`}
                    >
                      <span className="truncate">{preset.name}</span>
                      {preset.is_default && (
                        <span className="text-[10px] text-accent font-mono flex-shrink-0">{"*"}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 p-5 flex flex-col gap-4">
                {/* Name + Model row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted" htmlFor="preset-name">
                      Preset Name
                    </label>
                    <input
                      id="preset-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Instructor Style"
                      className="h-9 px-3 rounded-md border border-border bg-surface-2 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted" htmlFor="preset-model">
                      Script AI Model
                    </label>
                    <select
                      id="preset-model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="h-9 px-3 rounded-md border border-border bg-surface-2 text-sm text-foreground focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
                    >
                      <optgroup label="Top Tier">
                        {MODELS.filter((m) => m.tier === "top").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.provider})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Fast">
                        {MODELS.filter((m) => m.tier === "fast").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.provider})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Model chips */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Quick Select</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors focus-ring ${
                          model === m.id
                            ? "bg-foreground text-background"
                            : "border border-border text-muted hover:text-foreground hover:border-border-hover"
                        }`}
                        aria-pressed={model === m.id}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt tabs */}
                <div className="flex items-center gap-1 border-b border-border">
                  {PROMPT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                        activeTab === tab.id
                          ? "text-foreground"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Active prompt textarea */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {activeTab === "system" && "Used when generating the full spoken script from a blog post"}
                      {activeTab === "test" && "Used in test mode to generate a short preview and save ElevenLabs credits"}
                      {activeTab === "blog" && "Used by the AI agent when parsing blog listing pages to discover posts"}
                    </span>
                    <span className="text-[10px] text-muted font-mono">
                      {currentPromptValue.length}c
                    </span>
                  </div>
                  <textarea
                    value={currentPromptValue}
                    onChange={(e) => currentPromptSetter(e.target.value)}
                    placeholder={currentPromptPlaceholder}
                    rows={currentPromptRows}
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-surface-2 text-sm font-mono leading-relaxed text-foreground placeholder:text-muted/40 resize-y focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-surface-2/50 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {message && (
                <span className="text-xs text-muted animate-fade-in truncate">{message}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedId && !isDefault && (
                <button
                  onClick={handleDelete}
                  className="h-8 px-3 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors focus-ring"
                >
                  Delete
                </button>
              )}
              {selectedId && !isDefault && (
                <button
                  onClick={handleSetDefault}
                  className="h-8 px-3 rounded-md text-xs text-muted border border-border hover:text-foreground hover:border-border-hover transition-colors focus-ring"
                >
                  Set Default
                </button>
              )}
              {selectedId && (
                <button
                  onClick={handleSaveAsNew}
                  disabled={isSaving || !name.trim()}
                  className="h-8 px-3 rounded-md text-xs text-muted border border-border hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-40 focus-ring"
                >
                  Save as New
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim() || !systemPrompt.trim() || !testPrompt.trim()}
                className="h-8 px-4 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
              >
                {isSaving ? "Saving..." : selectedId ? "Save Changes" : "Create Preset"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
