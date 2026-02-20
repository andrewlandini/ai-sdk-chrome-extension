import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
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

    // Upsert into blog_posts_cache
    const rows = await sql`
      INSERT INTO blog_posts_cache (url, title)
      VALUES (${url}, ${title})
      ON CONFLICT (url) DO UPDATE SET title = COALESCE(NULLIF(EXCLUDED.title, ''), blog_posts_cache.title)
      RETURNING id, url, title, created_at
    `;

    const post = rows[0];

    return NextResponse.json({
      id: post.id,
      url: post.url,
      title: post.title,
    });
  } catch (err) {
    console.error("Add post error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add post" },
      { status: 500 }
    );
  }
}
