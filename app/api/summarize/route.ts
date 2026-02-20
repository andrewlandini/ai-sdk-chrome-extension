import { generateText } from "ai";
import { scrapeBlogPost } from "@/lib/scraper";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url, testMode } = await request.json();

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

    // Generate summary / script with AI
    const systemPrompt = testMode
      ? "You are a webpage content summarizer. Write exactly ONE short paragraph (2-3 sentences, max 30 words) summarizing the main point of this page. This is a test/preview generation to check voice settings. Use clear, conversational language that flows naturally when spoken aloud. Return only the summary text, nothing else."
      : "You are a webpage content summarizer. You are given a webpage (text, url, title) and you create a compelling trailer-like overview (max 50 words) that captures the main ideas and explains what readers will find valuable. Present the content in an engaging way that highlights the key insights and practical value without being overly promotional. Focus on what the page actually offers and why it matters. Use clear, conversational language that flows naturally when spoken aloud, as this summary will be read out loud as audio. Return only the summary (just text, no headings, no titles, no markdown), nothing else!";

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
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
