import {
  generateText,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put } from "@vercel/blob";
import { findByUrl, insertBlogAudio } from "@/lib/db";
import { scrapeBlogPost } from "@/lib/scraper";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Check if already processed
    const existing = await findByUrl(url);
    if (existing) {
      return Response.json({ entry: existing, cached: true });
    }

    // Scrape the blog post
    const scraped = await scrapeBlogPost(url);

    // Generate summary with AI
    const { text: summary } = await generateText({
      model: "xai/grok-3-fast",
      system:
        "You are a webpage content summarizer. You are given a webpage (text, url, title) and you create a compelling trailer-like overview (max 50 words) that captures the main ideas and explains what readers will find valuable. Present the content in an engaging way that highlights the key insights and practical value without being overly promotional. Focus on what the page actually offers and why it matters. Use clear, conversational language that flows naturally when spoken aloud, as this summary will be read out loud as audio. Return only the summary (just text, no headings, no titles, no markdown), nothing else!",
      prompt: JSON.stringify({
        text: scraped.text,
        url: scraped.url,
        title: scraped.title,
      }),
    });

    // Generate speech with ElevenLabs
    const { audio } = await generateSpeech({
      model: elevenlabs.speech("eleven_flash_v2_5"),
      text: summary,
    });

    // Upload to Vercel Blob
    const filename = `blog-audio/${Date.now()}-${encodeURIComponent(scraped.title.substring(0, 50))}.mp3`;
    const blob = await put(filename, audio.uint8Array, {
      access: "public",
      contentType: audio.mediaType || "audio/mpeg",
    });

    // Save to database
    const entry = await insertBlogAudio({
      url,
      title: scraped.title,
      summary,
      audio_url: blob.url,
    });

    return Response.json({ entry, cached: false });
  } catch (error) {
    console.error("Generate error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
