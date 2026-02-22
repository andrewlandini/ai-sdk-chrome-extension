import { getRawContentHistoryByUrl, insertRawContentHistory, deleteRawContentHistory } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return Response.json({ error: "url required" }, { status: 400 });

  const entries = await getRawContentHistoryByUrl(url);
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const { url, content, word_count } = await request.json();
  if (!url || !content) return Response.json({ error: "url and content required" }, { status: 400 });

  const entry = await insertRawContentHistory({ url, content, word_count: word_count ?? 0 });
  return Response.json({ entry });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await deleteRawContentHistory(Number(id));
  return Response.json({ success: true });
}
