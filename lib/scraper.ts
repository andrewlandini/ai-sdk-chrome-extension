import * as cheerio from "cheerio";

export interface ScrapedContent {
  title: string;
  text: string;
  url: string;
}

export async function scrapeBlogPost(url: string): Promise<ScrapedContent> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BlogAudioBot/1.0; +https://blog-audio.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $(
    "script, style, noscript, nav, footer, header, aside, iframe, form, [role='navigation'], [role='banner'], [role='contentinfo'], .sidebar, .comments, .advertisement, .ad, .social-share"
  ).remove();

  // Extract title
  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    "Untitled";

  // Extract main content - try article/main first, then fall back to body
  let text = "";

  const contentSelectors = [
    "article",
    '[role="main"]',
    "main",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
  ];

  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length && el.text().trim().length > 200) {
      text = el.text().trim();
      break;
    }
  }

  // Fallback to body text
  if (!text) {
    text = $("body").text().trim();
  }

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate to reasonable length for summarization (with paragraph-aware cutoff)
  const MAX_CONTENT_LENGTH = 40000;
  if (text.length > MAX_CONTENT_LENGTH) {
    // Cut at last paragraph break before limit to avoid mid-sentence truncation
    const cutText = text.substring(0, MAX_CONTENT_LENGTH);
    const lastBreak = cutText.lastIndexOf(". ");
    text = lastBreak > MAX_CONTENT_LENGTH * 0.8
      ? cutText.substring(0, lastBreak + 1)
      : cutText;
  }

  if (!text || text.length < 50) {
    throw new Error("Could not extract meaningful content from this URL");
  }

  return { title, text, url };
}
