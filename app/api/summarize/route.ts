import { streamText } from "ai";
import { scrapeBlogPost } from "@/lib/scraper";
import { getActivePromptPreset } from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url, customSystemPrompt, model: requestModel } = await request.json();

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

    // Determine which prompt to use
    let systemPrompt: string;
    let selectedModel: string = requestModel || "openai/gpt-4o";

    if (customSystemPrompt) {
      systemPrompt = customSystemPrompt;
    } else {
      const activePreset = await getActivePromptPreset();
      if (activePreset) {
        systemPrompt = activePreset.system_prompt;
        if (!requestModel) selectedModel = activePreset.model;
      } else {
        systemPrompt = "You are a blog-to-audio script writer. Reproduce the blog post content verbatim but summarize code blocks like an instructor. Return only the script text.";
      }
    }

    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      prompt: JSON.stringify({
        text: scraped.text,
        url: scraped.url,
        title: scraped.title,
      }),
    });

    // Stream as plain text with metadata in custom headers
    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Title": encodeURIComponent(scraped.title || ""),
        "X-Url": encodeURIComponent(scraped.url || url),
      },
    });
  } catch (error) {
    console.error("Summarize error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
