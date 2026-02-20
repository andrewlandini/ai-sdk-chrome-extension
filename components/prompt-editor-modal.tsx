"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PromptPreset {
  id: number;
  name: string;
  system_prompt: string;
  test_prompt: string;
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
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const presets = data?.presets ?? [];

  // Open/close the dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Select the default preset on load
  useEffect(() => {
    if (presets.length > 0 && selectedId === null) {
      const def = presets.find((p) => p.is_default) || presets[0];
      setSelectedId(def.id);
      setName(def.name);
      setSystemPrompt(def.system_prompt);
      setTestPrompt(def.test_prompt);
    }
  }, [presets, selectedId]);

  const handleSelectPreset = useCallback((preset: PromptPreset) => {
    setSelectedId(preset.id);
    setName(preset.name);
    setSystemPrompt(preset.system_prompt);
    setTestPrompt(preset.test_prompt);
    setMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !systemPrompt.trim() || !testPrompt.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      if (selectedId) {
        await fetch("/api/prompt-presets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedId, name, system_prompt: systemPrompt, test_prompt: testPrompt }),
        });
        setMessage("Preset updated");
      } else {
        const res = await fetch("/api/prompt-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, system_prompt: systemPrompt, test_prompt: testPrompt }),
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
  }, [selectedId, name, systemPrompt, testPrompt, mutate]);

  const handleSaveAsNew = useCallback(async () => {
    if (!name.trim() || !systemPrompt.trim() || !testPrompt.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/prompt-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name + " (copy)",
          system_prompt: systemPrompt,
          test_prompt: testPrompt,
        }),
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
  }, [name, systemPrompt, testPrompt, mutate]);

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
    setMessage(null);
  }, []);

  const activePreset = presets.find((p) => p.id === selectedId);
  const isDefault = activePreset?.is_default ?? false;

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-full max-w-full bg-transparent p-0 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-center min-h-full p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-3xl bg-surface-1 border border-border rounded-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <h2 className="text-base font-semibold">Prompt Editor</h2>
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
                  <button
                    onClick={handleNew}
                    className="text-xs text-accent hover:text-accent/80 transition-colors focus-ring rounded px-1"
                  >
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
                        <span className="text-[10px] text-accent font-mono flex-shrink-0">*</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 p-5 flex flex-col gap-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted" htmlFor="preset-name">
                    Preset Name
                  </label>
                  <input
                    id="preset-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Instructor Style"
                    className="h-9 px-3 rounded-md border border-border bg-surface-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                {/* System prompt */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted" htmlFor="system-prompt">
                      System Prompt
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {systemPrompt.length}c
                    </span>
                  </div>
                  <textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="The main system prompt used when generating the full script from a blog post..."
                    rows={10}
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-surface-2 text-sm font-mono leading-relaxed text-foreground placeholder:text-muted-foreground/30 resize-y focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                {/* Test prompt */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted" htmlFor="test-prompt">
                      Test Mode Prompt
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {testPrompt.length}c
                    </span>
                  </div>
                  <textarea
                    id="test-prompt"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="A shorter prompt used in test mode to save ElevenLabs credits..."
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-surface-2 text-sm font-mono leading-relaxed text-foreground placeholder:text-muted-foreground/30 resize-y focus:outline-none focus:border-accent transition-colors"
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
