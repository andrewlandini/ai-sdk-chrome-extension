import { generateText } from "ai";
import { scrapeBlogPost } from "@/lib/scraper";

export const maxDuration = 60;

export async function GET() {
  try {
    // Scrape the Vercel blog listing page to get post URLs
    const response = await fetch("https://vercel.com/blog", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BlogAudioBot/1.0; +https://blog-audio.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Vercel blog: ${response.status}`);
    }

    const html = await response.text();

    // Use AI to extract blog post links from the HTML
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      system: `You are an HTML parser. Extract all blog post links from this Vercel blog page HTML.
Return ONLY a valid JSON array of objects with "url" and "title" fields.
The URLs should be full URLs starting with https://vercel.com/blog/.
Only include actual blog post links, not category or tag pages.
Limit to the 30 most recent posts.
Example: [{"url":"https://vercel.com/blog/example","title":"Example Post"}]`,
      prompt: html.substring(0, 50000),
    });

    // Parse the AI response
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const posts = JSON.parse(cleaned);

    return Response.json({ posts });
  } catch (error) {
    console.error("Blog posts fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch blog posts";
    return Response.json({ error: message }, { status: 500 });
  }
}
