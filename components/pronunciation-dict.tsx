"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";

interface PronunciationEntry {
  id: number;
  original: string;
  pronunciation: string;
  category: string;
  created_at: string;
}

const CATEGORIES = [
  { value: "general", label: "General", color: "bg-muted-foreground/20 text-muted-foreground" },
  { value: "name", label: "Name", color: "bg-accent/20 text-accent" },
  { value: "brand", label: "Brand", color: "bg-success/20 text-success" },
  { value: "acronym", label: "Acronym", color: "bg-warning/20 text-warning" },
];

function categoryBadge(cat: string) {
  const found = CATEGORIES.find((c) => c.value === cat) || CATEGORIES[0];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${found.color}`}>
      {found.label}
    </span>
  );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PronunciationDictPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, mutate } = useSWR<{ entries: PronunciationEntry[] }>(open ? "/api/pronunciation" : null, fetcher);
  const entries = data?.entries ?? [];

  const [search, setSearch] = useState("");
  const [original, setOriginal] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [category, setCategory] = useState("general");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.original.toLowerCase().includes(q) || e.pronunciation.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
  });

  const resetForm = useCallback(() => {
    setOriginal("");
    setPronunciation("");
    setCategory("general");
    setEditId(null);
    setError("");
  }, []);

  const handleSave = async () => {
    if (!original.trim() || !pronunciation.trim()) {
      setError("Both fields are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { id: editId, original: original.trim(), pronunciation: pronunciation.trim(), category }
        : { original: original.trim(), pronunciation: pronunciation.trim(), category };
      const res = await fetch("/api/pronunciation", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      mutate();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: PronunciationEntry) => {
    setOriginal(entry.original);
    setPronunciation(entry.pronunciation);
    setCategory(entry.category);
    setEditId(entry.id);
    setError("");
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch("/api/pronunciation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      mutate();
      if (editId === id) resetForm();
    } catch {
      // silent
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-1 border border-border rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Training Words</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Custom pronunciation mappings for TTS</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 focus-ring rounded"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add/Edit form */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-muted-foreground block mb-1">Original</label>
              <input
                type="text"
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="Malte Ubl"
                className="w-full h-7 bg-background border border-border rounded px-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus-ring"
              />
            </div>
            <div className="flex items-end text-muted-foreground/40 pb-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-muted-foreground block mb-1">Say as</label>
              <input
                type="text"
                value={pronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
                placeholder="Mall'tay ewble"
                className="w-full h-7 bg-background border border-border rounded px-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors focus-ring ${
                    category === c.value ? c.color : "bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {editId && (
              <button
                onClick={resetForm}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded focus-ring"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !original.trim() || !pronunciation.trim()}
              className="px-3 py-1 bg-accent text-primary-foreground text-[10px] font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
            >
              {saving ? "Saving..." : editId ? "Update" : "Add"}
            </button>
          </div>
          {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search training words..."
              className="w-full h-7 bg-background border border-border rounded pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus-ring"
            />
          </div>
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="mb-2 opacity-40">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-xs">No training words yet</p>
              <p className="text-[10px] mt-0.5">Add words above to customize pronunciation</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-muted-foreground">No matches for &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-4 py-2 hover:bg-surface-2/50 transition-colors group ${
                    editId === entry.id ? "bg-accent/5" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{entry.original}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/40 flex-shrink-0" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      <span className="text-xs text-accent font-mono">{entry.pronunciation}</span>
                    </div>
                  </div>
                  {categoryBadge(entry.category)}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded"
                      aria-label={`Edit ${entry.original}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors focus-ring rounded"
                      aria-label={`Delete ${entry.original}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex-shrink-0">
            <p className="text-[9px] text-muted-foreground">
              {entries.length} training word{entries.length !== 1 ? "s" : ""} -- applied automatically during script generation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
