import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return Response.json({ error: "Missing url" }, { status: 400 });

  const rows = await sql`SELECT raw_content FROM blog_posts_cache WHERE url = ${url} LIMIT 1`;
  const rawContent = rows[0]?.raw_content || null;

  return Response.json({ rawContent });
}
