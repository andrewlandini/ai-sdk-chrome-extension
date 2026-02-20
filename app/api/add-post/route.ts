import { NextResponse } from "next/server";
import { upsertBlogPosts, getCachedBlogPosts } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Scrape the page title
    let title = new URL(url).pathname.split("/").filter(Boolean).pop() || "Untitled";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 BlogAudioBot/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (match?.[1]) {
          title = match[1]
            .replace(/\s*[|\-–—]\s*Vercel.*$/i, "")
            .replace(/\s*[|\-–—]\s*Blog.*$/i, "")
            .trim();
        }
      }
    } catch {
      // Use slug-based title as fallback
    }

    // Upsert into blog_posts_cache using db.ts
    await upsertBlogPosts([{ url, title }]);

    // Fetch the inserted/updated post to return its data
    const posts = await getCachedBlogPosts();
    const post = posts.find((p) => p.url === url);

    return NextResponse.json({
      id: post?.id ?? null,
      url,
      title: post?.title ?? title,
    });
  } catch (err) {
    console.error("Add post error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add post" },
      { status: 500 }
    );
  }
}
