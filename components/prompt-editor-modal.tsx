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
  { id: "system" as const, label: "Script Prompt", modelKey: "model" as const, defaultModel: "openai/gpt-4o", desc: "AI model for generating spoken scripts from blog posts" },
  { id: "test" as const, label: "Test Prompt", modelKey: "model" as const, defaultModel: "openai/gpt-4o", desc: "Uses the same model as Script Prompt (test mode)" },
  { id: "blog" as const, label: "Blog Fetch", modelKey: "blogFetchModel" as const, defaultModel: "openai/gpt-4o-mini", desc: "AI model for parsing blog listing pages to discover posts" },
  { id: "style" as const, label: "Style Agent", modelKey: "styleAgentModel" as const, defaultModel: "openai/gpt-4o", desc: "AI model for adding v3 Audio Tags to scripts" },
];

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
  blog_fetch_model: string;
  style_agent_model: string;
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
  const [blogFetchModel, setBlogFetchModel] = useState("openai/gpt-4o-mini");
  const [styleAgentModel, setStyleAgentModel] = useState("openai/gpt-4o");
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
      loadPresetWrapped(def);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets, selectedId]);

  const loadPreset = (preset: PromptPreset) => {
    setSelectedId(preset.id);
    setName(preset.name);
    setSystemPrompt(preset.system_prompt);
    setTestPrompt(preset.test_prompt);
    setBlogFetchPrompt(preset.blog_fetch_prompt || DEFAULT_BLOG_FETCH_PROMPT);
    setModel(preset.model || "openai/gpt-4o");
    setBlogFetchModel(preset.blog_fetch_model || "openai/gpt-4o-mini");
    setStyleAgentModel(preset.style_agent_model || "openai/gpt-4o");
    setMessage(null);
  };

  // Per-tab prompt/model accessors
  const getTabPrompt = (tab: PromptTab) => {
    switch (tab) {
      case "system": return systemPrompt;
      case "test": return testPrompt;
      case "blog": return blogFetchPrompt;
      case "style": return ""; // style agent prompt is hardcoded server-side
    }
  };
  const setTabPrompt = (tab: PromptTab, val: string) => {
    switch (tab) {
      case "system": setSystemPrompt(val); break;
      case "test": setTestPrompt(val); break;
      case "blog": setBlogFetchPrompt(val); break;
    }
  };
  const getTabModel = (tab: PromptTab) => {
    switch (tab) {
      case "system": case "test": return model;
      case "blog": return blogFetchModel;
      case "style": return styleAgentModel;
    }
  };
  const setTabModel = (tab: PromptTab, val: string) => {
    switch (tab) {
      case "system": case "test": setModel(val); break;
      case "blog": setBlogFetchModel(val); break;
      case "style": setStyleAgentModel(val); break;
    }
  };

  const getPayload = useCallback(() => ({
    name,
    system_prompt: systemPrompt,
    test_prompt: testPrompt,
    blog_fetch_prompt: blogFetchPrompt,
    model,
    blog_fetch_model: blogFetchModel,
    style_agent_model: styleAgentModel,
  }), [name, systemPrompt, testPrompt, blogFetchPrompt, model, blogFetchModel, styleAgentModel]);

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
    if (!window.confirm(`Delete prompt preset "${preset?.name || "this preset"}"? This cannot be undone.`)) return;
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
    setBlogFetchModel("openai/gpt-4o-mini");
    setStyleAgentModel("openai/gpt-4o");
    setMessage(null);
  }, []);

  // Auto-save: debounce prompt/model changes and save as a new preset or update existing
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedPreset = useRef(false);

  // Track when a preset is loaded to skip the first auto-save trigger
  const loadPresetOriginal = loadPreset;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadPresetWrapped = useCallback((preset: PromptPreset) => {
    hasLoadedPreset.current = true;
    loadPresetOriginal(preset);
    // Reset flag after a tick so subsequent edits trigger auto-save
    setTimeout(() => { hasLoadedPreset.current = false; }, 100);
  }, []);

  useEffect(() => {
    // Skip auto-save if we just loaded a preset or if prompts are empty
    if (hasLoadedPreset.current) return;
    if (!systemPrompt.trim() && !testPrompt.trim()) return;
    // Must have a name to save
    if (!name.trim()) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      const payload = getPayload();
      try {
        if (selectedId) {
          // Update existing preset
          await fetch("/api/prompt-presets", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: selectedId, ...payload }),
          });
        } else {
          // Create new preset with auto-generated name
          const autoName = name.trim() || `Preset ${new Date().toLocaleTimeString()}`;
          const res = await fetch("/api/prompt-presets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, name: autoName }),
          });
          const data = await res.json();
          if (data.preset) {
            setSelectedId(data.preset.id);
          }
        }
        mutate();
      } catch {
        // Silent fail on auto-save
      }
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemPrompt, testPrompt, blogFetchPrompt, model, blogFetchModel, styleAgentModel]);

  const activePreset = presets.find((p) => p.id === selectedId);
  const isDefault = activePreset?.is_default ?? false;
  const currentTabConfig = PROMPT_TABS.find((t) => t.id === activeTab)!;
  const isStyleTab = activeTab === "style";

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-full max-w-full bg-transparent p-0 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-center min-h-full p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {/* Fixed dimensions so switching tabs doesn't resize */}
        <div className="w-full max-w-4xl bg-surface-1 border border-border rounded-lg overflow-hidden shadow-2xl flex flex-col" style={{ height: "min(85vh, 720px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h2 className="text-sm font-semibold">Prompt Editor</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors focus-ring" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content area -- fixed height, internal scroll */}
          <div className="flex-1 min-h-0 flex">
            {/* Preset sidebar */}
            <div className="w-[180px] border-r border-border flex-shrink-0 flex flex-col">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Presets</span>
                <button onClick={handleNew} className="text-[10px] text-accent hover:text-accent/80 transition-colors focus-ring rounded px-1">
                  + New
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => loadPresetWrapped(preset)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition-colors focus-ring ${
                      selectedId === preset.id
                        ? "bg-surface-3 text-foreground"
                        : "text-muted hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <span className="truncate flex-1">{preset.name}</span>
                    {preset.is_default && (
                      <span className="text-[9px] text-accent font-mono flex-shrink-0">def</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor area */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Name row */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-shrink-0">
                <label className="text-[10px] font-medium text-muted uppercase tracking-wider flex-shrink-0" htmlFor="preset-name">
                  Name
                </label>
                <input
                  id="preset-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Instructor Style"
                  className="flex-1 h-7 px-2 rounded border border-border bg-surface-2 text-xs text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center border-b border-border flex-shrink-0 px-4">
                {PROMPT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                      activeTab === tab.id ? "text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                    )}
                  </button>
                ))}
              </div>

              {/* Per-tab model selector */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-2/30 flex-shrink-0">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wider flex-shrink-0">Model</span>
                <div className="flex flex-wrap gap-1">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setTabModel(activeTab, m.id)}
                      disabled={activeTab === "test"}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors focus-ring ${
                        getTabModel(activeTab) === m.id
                          ? "bg-foreground text-background"
                          : activeTab === "test"
                          ? "border border-border/50 text-muted/40 cursor-not-allowed"
                          : "border border-border text-muted hover:text-foreground hover:border-border-hover"
                      }`}
                      aria-pressed={getTabModel(activeTab) === m.id}
                      title={activeTab === "test" ? "Test mode uses the Script Prompt model" : m.label}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt textarea -- fills remaining space */}
              <div className="flex-1 min-h-0 flex flex-col px-4 py-3 gap-1.5">
                <div className="flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] text-muted">
                    {currentTabConfig.desc}
                  </span>
                  {!isStyleTab && (
                    <span className="text-[10px] text-muted font-mono">
                      {getTabPrompt(activeTab).length}c
                    </span>
                  )}
                </div>
                {isStyleTab ? (
                  <div className="flex-1 min-h-0 overflow-y-auto rounded border border-border bg-surface-2/50 p-3">
                    <p className="text-xs text-muted leading-relaxed">
                      The Style Agent prompt is managed server-side and includes the full Eleven v3 Audio Tags reference. It is not editable here.
                    </p>
                    <p className="text-xs text-muted leading-relaxed mt-2">
                      You can change which AI model is used to style scripts using the model selector above.
                    </p>
                  </div>
                ) : (
                  <textarea
                    value={getTabPrompt(activeTab)}
                    onChange={(e) => setTabPrompt(activeTab, e.target.value)}
                    className="flex-1 min-h-0 w-full px-3 py-2.5 rounded border border-border bg-surface-2 text-xs font-mono leading-relaxed text-foreground placeholder:text-muted/40 resize-none focus:outline-none focus:border-accent transition-colors"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-surface-2/50 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {message && (
                <span className="text-[10px] text-muted animate-fade-in truncate">{message}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {selectedId && !isDefault && (
                <button
                  onClick={handleDelete}
                  className="h-7 px-2.5 rounded text-[11px] text-destructive hover:bg-destructive/10 transition-colors focus-ring"
                >
                  Delete
                </button>
              )}
              {selectedId && !isDefault && (
                <button
                  onClick={handleSetDefault}
                  className="h-7 px-2.5 rounded text-[11px] text-muted border border-border hover:text-foreground hover:border-border-hover transition-colors focus-ring"
                >
                  Set Default
                </button>
              )}
              {selectedId && (
                <button
                  onClick={handleSaveAsNew}
                  disabled={isSaving || !name.trim()}
                  className="h-7 px-2.5 rounded text-[11px] text-muted border border-border hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-40 focus-ring"
                >
                  Save as New
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim() || !systemPrompt.trim() || !testPrompt.trim()}
                className="h-7 px-3 rounded bg-foreground text-background text-[11px] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
              >
                {isSaving ? "Saving..." : selectedId ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
