import { streamText } from "ai";
import { scrapeBlogPost } from "@/lib/scraper";
import { getActivePromptPreset, getPromptNodeBySlug } from "@/lib/db";

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

    // Determine which prompt to use: custom > prompt_nodes > legacy presets > fallback
    let systemPrompt: string;
    let selectedModel: string = requestModel || "openai/gpt-4o";

    if (customSystemPrompt) {
      systemPrompt = customSystemPrompt;
    } else {
      const node = await getPromptNodeBySlug("script_generator");
      if (node) {
        systemPrompt = node.user_prompt || node.default_prompt;
        if (!requestModel) selectedModel = node.model;
      } else {
        const activePreset = await getActivePromptPreset();
        if (activePreset) {
          systemPrompt = activePreset.system_prompt;
          if (!requestModel) selectedModel = activePreset.model;
        } else {
          systemPrompt = "You are a blog-to-audio script writer. Reproduce the blog post content faithfully. Do NOT add any greeting, introduction, welcome, sign-off, or outro — jump straight into the content from the very first word. Summarize code blocks like an instructor explaining them in plain English. Return only the script text.";
        }
      }
    }

    // Build blog content payload
    const blogContent = JSON.stringify({
      text: scraped.text,
      url: scraped.url,
      title: scraped.title,
    });

    // Inject {{BLOG_CONTENT}} placeholder if present, otherwise pass as user prompt
    let finalSystem: string;
    let finalPrompt: string;
    if (systemPrompt.includes("{{BLOG_CONTENT}}")) {
      finalSystem = systemPrompt.replace("{{BLOG_CONTENT}}", blogContent);
      finalPrompt = "Convert the blog content above into an audio script.";
    } else {
      finalSystem = systemPrompt;
      finalPrompt = blogContent;
    }

    const result = streamText({
      model: selectedModel,
      system: finalSystem,
      prompt: finalPrompt,
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
