"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BlogPost {
  url: string;
  title: string;
  description?: string;
  date?: string;
  category?: string;
}

interface BlogCatalogProps {
  onSelect: (url: string, title: string) => void;
}

export function BlogCatalog({ onSelect }: BlogCatalogProps) {
  const { data, error, isLoading, mutate } = useSWR<{
    posts: BlogPost[];
    count: number;
  }>("/api/blog-posts", fetcher);

  const [isFetching, setIsFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const handleFetchMore = useCallback(async () => {
    setIsFetching(true);
    setFetchMessage(null);
    try {
      const res = await fetch("/api/blog-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFetchMessage(data.message || `Found ${data.newCount} new posts`);
      setPage((p) => p + 1);
      mutate();
    } catch (err) {
      setFetchMessage(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setIsFetching(false);
    }
  }, [page, mutate]);

  const posts = data?.posts ?? [];
  const filtered = search.trim()
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase()) ||
          p.category?.toLowerCase().includes(search.toLowerCase())
      )
    : posts;

  return (
    <div className="flex flex-col gap-3">
      {/* Search + Fetch */}
      <div className="flex items-center gap-2">
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
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${posts.length} posts...`}
            className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-surface-2 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent transition-colors"
            aria-label="Search blog posts"
          />
        </div>
        <button
          onClick={handleFetchMore}
          disabled={isFetching}
          className="h-8 px-3 rounded-md border border-border text-xs text-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-40 focus-ring flex items-center gap-1.5 flex-shrink-0"
        >
          {isFetching ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              <span>{posts.length === 0 ? "Fetch Posts" : "Fetch More"}</span>
            </>
          )}
        </button>
      </div>

      {/* Status message */}
      {fetchMessage && (
        <p className="text-xs text-muted animate-fade-in">{fetchMessage}</p>
      )}

      {/* Error */}
      {error && (
        <div className="py-4 text-center text-xs text-destructive" role="alert">
          Failed to load cached posts. Click Fetch Posts to start.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && !error && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted">No blog posts cached yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &quot;Fetch Posts&quot; to discover posts from vercel.com/blog
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-2.5 flex items-center gap-3">
              <div
                className="h-4 bg-surface-3 rounded flex-1"
                style={{ animationDelay: `${i * 80}ms`, animation: "pulse-bar 1.5s infinite ease-in-out" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Post list */}
      {filtered.length > 0 && (
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border -mx-1">
          {filtered.map((post, i) => (
            <button
              key={post.url}
              onClick={() => onSelect(post.url, post.title)}
              className="w-full text-left px-2 py-2.5 flex items-start gap-3 group transition-colors hover:bg-surface-2 rounded-md focus-ring"
            >
              <span className="text-[10px] text-muted-foreground font-mono w-5 flex-shrink-0 tabular-nums text-right mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-muted group-hover:text-foreground transition-colors line-clamp-1">
                  {post.title}
                </span>
                {(post.date || post.category) && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {post.date && (
                      <span className="text-[10px] text-muted-foreground font-mono">{post.date}</span>
                    )}
                    {post.category && (
                      <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-surface-3">{post.category}</span>
                    )}
                  </div>
                )}
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* No results for search */}
      {search.trim() && filtered.length === 0 && posts.length > 0 && (
        <p className="text-xs text-muted text-center py-4">
          No posts matching &quot;{search}&quot;
        </p>
      )}

      {/* Footer count */}
      {posts.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground font-mono">
            {filtered.length === posts.length
              ? `${posts.length} posts cached`
              : `${filtered.length} of ${posts.length} shown`}
          </span>
        </div>
      )}
    </div>
  );
}
