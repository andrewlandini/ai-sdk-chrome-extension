import { sql } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { url, script } = await request.json();
    if (!url || !script) {
      return Response.json({ error: "url and script are required" }, { status: 400 });
    }

    await sql`
      UPDATE blog_posts_cache SET script = ${script} WHERE url = ${url}
    `;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Save script error:", error);
    return Response.json({ error: "Failed to save script" }, { status: 500 });
  }
}
