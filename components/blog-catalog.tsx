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
    <div className="flex flex-col">
      {error && (
        <div className="py-6 text-center text-sm text-destructive" role="alert">
          Failed to load blog posts
        </div>
      )}

      {!isLoading && data?.posts?.length === 0 && (
        <div className="py-6 text-center text-sm text-muted">
          No blog posts found
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-1 py-3 flex items-center gap-3">
              <div className="h-4 bg-surface-3 rounded flex-1" style={{ animationDelay: `${i * 80}ms`, animation: "pulse-bar 1.5s infinite ease-in-out" }} />
            </div>
          ))}
        </div>
      )}

      {data?.posts && (
        <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
          {data.posts.map((post, i) => (
            <button
              key={post.url}
              onClick={() => onSelect(post.url, post.title)}
              className="w-full text-left px-1 py-2.5 flex items-center gap-3 group transition-colors hover:bg-surface-2 rounded-md focus-ring"
            >
              <span className="text-[11px] text-muted-foreground font-mono w-5 flex-shrink-0 tabular-nums text-right">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm text-muted group-hover:text-foreground transition-colors truncate flex-1">
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
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
