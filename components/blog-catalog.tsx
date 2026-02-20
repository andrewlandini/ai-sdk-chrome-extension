"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BlogPost {
  url: string;
  title: string;
}

interface BlogCatalogProps {
  onSelect: (url: string, title: string) => void;
}

export function BlogCatalog({ onSelect }: BlogCatalogProps) {
  const { data, error, isLoading } = useSWR<{ posts: BlogPost[] }>(
    "/api/blog-posts",
    fetcher
  );

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Vercel Blog</h3>
        {isLoading && (
          <span className="text-xs text-muted font-mono">Loading...</span>
        )}
      </div>

      <div className="max-h-[480px] overflow-y-auto">
        {error && (
          <div className="px-4 py-8 text-center text-sm text-destructive">
            Failed to load blog posts
          </div>
        )}

        {!isLoading && data?.posts?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No blog posts found
          </div>
        )}

        {isLoading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-border-light px-4 py-3 flex items-center gap-3"
            >
              <div className="h-4 bg-border-light rounded w-full animate-pulse" />
            </div>
          ))}

        {data?.posts?.map((post, i) => (
          <button
            key={post.url}
            onClick={() => onSelect(post.url, post.title)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-card-hover transition-colors group border-b border-border-light last:border-b-0"
          >
            <span className="text-xs text-muted-foreground font-mono w-5 flex-shrink-0 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm text-muted group-hover:text-foreground transition-colors truncate">
              {post.title}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
