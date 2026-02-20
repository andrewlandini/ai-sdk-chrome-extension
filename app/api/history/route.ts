import { getAllBlogAudio, getCachedBlogPosts } from "@/lib/db";

export async function GET() {
  try {
    const [entries, cachedPosts] = await Promise.all([
      getAllBlogAudio(),
      getCachedBlogPosts(),
    ]);

    // Build a map of cached scripts by URL
    const scriptMap = new Map<string, string>();
    for (const p of cachedPosts) {
      if (p.script) scriptMap.set(p.url, p.script);
    }

    // Attach cached scripts to audio entries
    const enrichedEntries = entries.map((e) => ({
      ...e,
      cached_script: scriptMap.get(e.url) ?? null,
    }));

    // Find cached posts that have no audio entries
    const urlsWithAudio = new Set(entries.map((e) => e.url));
    const postsWithoutAudio = cachedPosts
      .filter((p) => !urlsWithAudio.has(p.url))
      .map((p) => ({
        id: -1, // sentinel: no audio yet
        url: p.url,
        title: p.title,
        summary: null,
        audio_url: "",
        voice_id: null,
        model_id: null,
        stability: null,
        similarity_boost: null,
        label: null,
        created_at: p.created_at,
        cached_script: p.script ?? null,
      }));

    return Response.json({ entries: [...enrichedEntries, ...postsWithoutAudio] });
  } catch (error) {
    console.error("History fetch error:", error);
    return Response.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
