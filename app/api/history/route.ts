import { getAllBlogAudio } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const [entries, cachedPosts] = await Promise.all([
      getAllBlogAudio(),
      sql`SELECT url, title, created_at FROM blog_posts_cache ORDER BY created_at DESC`,
    ]);

    // Find cached posts that have no audio entries
    const urlsWithAudio = new Set(entries.map((e) => e.url));
    const postsWithoutAudio = cachedPosts
      .filter((p) => !urlsWithAudio.has(p.url as string))
      .map((p) => ({
        id: -1, // sentinel: no audio yet
        url: p.url as string,
        title: p.title as string,
        summary: null,
        audio_url: "",
        voice_id: null,
        model_id: null,
        stability: null,
        similarity_boost: null,
        label: null,
        created_at: p.created_at as string,
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
