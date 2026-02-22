import { sql } from "@/lib/db";
import { scrapeBlogPost } from "@/lib/scraper";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return Response.json({ error: "Missing url" }, { status: 400 });

  const rows = await sql`SELECT raw_content FROM blog_posts_cache WHERE url = ${url} LIMIT 1`;
  const rawContent = rows[0]?.raw_content || null;

  return Response.json({ rawContent });
}

// POST: scrape blog text and store it
export async function POST(req: Request) {
  const { url, force } = await req.json();
  if (!url) return Response.json({ error: "Missing url" }, { status: 400 });

  // Check if already scraped (skip if force re-scrape)
  if (!force) {
    const existing = await sql`SELECT raw_content FROM blog_posts_cache WHERE url = ${url} LIMIT 1`;
    if (existing[0]?.raw_content) {
      return Response.json({ rawContent: existing[0].raw_content });
    }
  }

  const scraped = await scrapeBlogPost(url);
  const rawContent = scraped.text || "";

  // Upsert
  await sql`
    INSERT INTO blog_posts_cache (url, title, raw_content)
    VALUES (${url}, ${scraped.title || ''}, ${rawContent})
    ON CONFLICT (url) DO UPDATE SET raw_content = EXCLUDED.raw_content
  `;

  return Response.json({ rawContent });
}
