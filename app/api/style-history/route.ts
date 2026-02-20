import { getStyleHistoryByUrl, insertStyleHistory, deleteStyleHistory } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return Response.json({ error: "URL required" }, { status: 400 });

  const entries = await getStyleHistoryByUrl(url);
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { url, script, vibe, word_count } = body;
  if (!url || !script) return Response.json({ error: "URL and script required" }, { status: 400 });

  const entry = await insertStyleHistory({ url, script, vibe, word_count });
  return Response.json({ entry });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ID required" }, { status: 400 });

  await deleteStyleHistory(Number(id));
  return Response.json({ success: true });
}
