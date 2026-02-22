import { getScriptHistoryByUrl, insertScriptHistory, deleteScriptHistory } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return Response.json({ error: "url required" }, { status: 400 });

  const entries = await getScriptHistoryByUrl(url);
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const { url, script, word_count } = await request.json();
  if (!url || !script) return Response.json({ error: "url and script required" }, { status: 400 });

  const entry = await insertScriptHistory({ url, script, word_count: word_count ?? 0 });
  return Response.json({ entry });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await deleteScriptHistory(Number(id));
  return Response.json({ success: true });
}
