import { generateText } from "ai";
import {
  getCachedBlogPosts,
  upsertBlogPosts,
  getCachedPostCount,
} from "@/lib/db";

export const maxDuration = 120;

// GET: return cached blog posts from Neon
export async function GET() {
  try {
    const posts = await getCachedBlogPosts();
    const count = posts.length;
    return Response.json({ posts, count });
  } catch (error) {
    console.error("Blog posts cache read error:", error);
    return Response.json({ error: "Failed to read cached posts" }, { status: 500 });
  }
}

// POST: fetch more blog posts from vercel.com/blog using an AI agent
export async function POST(request: Request) {
  try {
    const { page } = await request.json().catch(() => ({ page: 1 }));
    const existingCount = await getCachedPostCount();

    // Fetch the Vercel blog listing page
    const blogUrl = page > 1 ? `https://vercel.com/blog?page=${page}` : "https://vercel.com/blog";
    const response = await fetch(blogUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlogAudioBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Vercel blog: ${response.status}`);
    }

    const html = await response.text();

    // Use AI to intelligently extract blog post data from the HTML
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      system: `You are an expert HTML parser and web scraper. Your job is to extract ALL blog post entries from this Vercel blog page HTML.

For each blog post, extract:
- "url": the full URL (must start with https://vercel.com/blog/)
- "title": the post title
- "description": a short description/subtitle if available, otherwise null
- "date": publication date if visible, otherwise null  
- "category": category/tag if visible (e.g. "Engineering", "Product"), otherwise null

RULES:
1. Only include actual blog post links, NOT navigation, category, tag, or pagination links
2. Extract EVERY post on the page - do not skip any
3. Look for patterns like <a href="/blog/..."> with nearby heading/title elements
4. URLs in the HTML may be relative (e.g. /blog/some-post) - convert them to full URLs (https://vercel.com/blog/some-post)
5. Return ONLY a valid JSON array, nothing else
6. If you find links that look like blog posts but aren't sure, include them

Example output:
[{"url":"https://vercel.com/blog/example","title":"Example Post","description":"A short description","date":"Feb 14, 2026","category":"Engineering"}]`,
      prompt: html.substring(0, 80000),
    });

    // Parse the AI response
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const posts = JSON.parse(cleaned);

    if (!Array.isArray(posts) || posts.length === 0) {
      return Response.json({
        posts: await getCachedBlogPosts(),
        count: existingCount,
        newCount: 0,
        message: "No new posts found on this page",
      });
    }

    // Upsert into cache
    const upserted = await upsertBlogPosts(posts);

    // Return full cached list
    const allPosts = await getCachedBlogPosts();

    return Response.json({
      posts: allPosts,
      count: allPosts.length,
      newCount: upserted,
      message: `Found ${posts.length} posts, ${allPosts.length - existingCount} new`,
    });
  } catch (error) {
    console.error("Blog posts fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch blog posts";
    return Response.json({ error: message }, { status: 500 });
  }
}
