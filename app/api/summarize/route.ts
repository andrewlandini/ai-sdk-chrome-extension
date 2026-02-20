import { generateText } from "ai";
import { scrapeBlogPost } from "@/lib/scraper";
import { getActivePromptPreset } from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url, testMode, customSystemPrompt, customTestPrompt } = await request.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Scrape the blog post
    const scraped = await scrapeBlogPost(url);

    // Determine which prompt to use:
    // 1. Custom prompts passed from the client (prompt editor)
    // 2. Active preset from the database
    // 3. Hardcoded fallback
    let systemPrompt: string;

    if (testMode && customTestPrompt) {
      systemPrompt = customTestPrompt;
    } else if (!testMode && customSystemPrompt) {
      systemPrompt = customSystemPrompt;
    } else {
      const activePreset = await getActivePromptPreset();
      if (activePreset) {
        systemPrompt = testMode ? activePreset.test_prompt : activePreset.system_prompt;
      } else {
        systemPrompt = testMode
          ? "You are a blog-to-audio script writer. Write exactly ONE short paragraph (2-3 sentences, max 30 words) summarizing the main point of this page. Return only the text."
          : "You are a blog-to-audio script writer. Reproduce the blog post content verbatim but summarize code blocks like an instructor. Return only the script text.";
      }
    }

    const { text: summary } = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: JSON.stringify({
        text: scraped.text,
        url: scraped.url,
        title: scraped.title,
      }),
    });

    return Response.json({
      title: scraped.title,
      summary,
      url: scraped.url,
    });
  } catch (error) {
    console.error("Summarize error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
