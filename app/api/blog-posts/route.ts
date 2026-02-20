import { generateText } from "ai";
import {
  getCachedBlogPosts,
  upsertBlogPosts,
  getCachedPostCount,
  getActivePromptPreset,
} from "@/lib/db";

export const maxDuration = 300;

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

// GET: return cached blog posts from Neon
export async function GET() {
  try {
    const posts = await getCachedBlogPosts();
    const count = posts.length;
    return Response.json({ posts, count });
  } catch (error) {
    console.error("Blog posts cache read error:", error);
    return Response.json(
      { error: "Failed to read cached posts" },
      { status: 500 }
    );
  }
}

// POST: fetch blog posts from vercel.com/blog using smart multi-page scraping
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxPages = Math.min(body.maxPages ?? 5, 20);
    const customPrompt = body.blogFetchPrompt;

    const existingCount = await getCachedPostCount();

    // Determine which prompt to use
    let fetchPrompt = DEFAULT_BLOG_FETCH_PROMPT;
    if (customPrompt) {
      fetchPrompt = customPrompt;
    } else {
      const activePreset = await getActivePromptPreset();
      if (activePreset?.blog_fetch_prompt) {
        fetchPrompt = activePreset.blog_fetch_prompt;
      }
    }

    // Strategy: Use WebFetch-style content extraction across multiple "pages"
    // Vercel blog uses client-side loading for "Show more" so we need to try
    // multiple approaches to get all posts
    const allDiscoveredPosts: Array<{
      url: string;
      title: string;
      description?: string;
      date?: string;
      category?: string;
    }> = [];

    const pageUrls: string[] = [];
    for (let i = 0; i < maxPages; i++) {
      if (i === 0) {
        pageUrls.push("https://vercel.com/blog");
      } else {
        // Vercel blog may use query params or category pages
        pageUrls.push(`https://vercel.com/blog?after=${i * 20}`);
      }
    }

    // Also try category pages to discover more posts
    const categories = [
      "engineering",
      "product",
      "customers",
      "company-news",
      "changelog",
    ];
    for (const cat of categories) {
      pageUrls.push(`https://vercel.com/blog/category/${cat}`);
    }

    // Fetch pages in parallel batches of 3
    const batchSize = 3;
    let pagesProcessed = 0;
    let totalNewPosts = 0;

    for (let i = 0; i < pageUrls.length; i += batchSize) {
      const batch = pageUrls.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (pageUrl) => {
          const response = await fetch(pageUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) return [];

          const html = await response.text();

          // Send the full page content to the AI for parsing
          const { text } = await generateText({
            model: "openai/gpt-4o-mini",
            system: fetchPrompt,
            prompt: `Parse this page content from ${pageUrl}. Extract all blog posts:\n\n${html.substring(0, 100000)}`,
          });

          const cleaned = text
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          try {
            const posts = JSON.parse(cleaned);
            return Array.isArray(posts) ? posts : [];
          } catch {
            return [];
          }
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.length > 0) {
          allDiscoveredPosts.push(...result.value);
        }
      }
      pagesProcessed += batch.length;
    }

    // Deduplicate by URL
    const uniquePosts = new Map<
      string,
      (typeof allDiscoveredPosts)[0]
    >();
    for (const post of allDiscoveredPosts) {
      if (
        post.url &&
        post.title &&
        post.url.includes("vercel.com/blog/")
      ) {
        // Normalize URL
        let url = post.url;
        if (url.startsWith("/blog/")) {
          url = `https://vercel.com${url}`;
        }
        if (!url.startsWith("https://")) {
          url = `https://${url}`;
        }
        uniquePosts.set(url, { ...post, url });
      }
    }

    const postsToUpsert = Array.from(uniquePosts.values());

    if (postsToUpsert.length === 0) {
      return Response.json({
        posts: await getCachedBlogPosts(),
        count: existingCount,
        newCount: 0,
        pagesProcessed,
        message: "No new posts discovered",
      });
    }

    // Upsert all discovered posts
    const upserted = await upsertBlogPosts(postsToUpsert);
    const allPosts = await getCachedBlogPosts();
    totalNewPosts = allPosts.length - existingCount;

    return Response.json({
      posts: allPosts,
      count: allPosts.length,
      newCount: Math.max(totalNewPosts, 0),
      discovered: postsToUpsert.length,
      pagesProcessed,
      message: `Scraped ${pagesProcessed} pages, discovered ${postsToUpsert.length} posts (${Math.max(totalNewPosts, 0)} new)`,
    });
  } catch (error) {
    console.error("Blog posts fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch blog posts";
    return Response.json({ error: message }, { status: 500 });
  }
}
