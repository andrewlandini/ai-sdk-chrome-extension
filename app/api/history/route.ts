import { getAllBlogAudio, getCachedBlogPosts } from "@/lib/db";

export async function GET() {
  try {
    const [entries, cachedPosts] = await Promise.all([
      getAllBlogAudio(),
      getCachedBlogPosts(),
    ]);

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
      }));

    return Response.json({ entries: [...entries, ...postsWithoutAudio] });
  } catch (error) {
    console.error("History fetch error:", error);
    return Response.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
