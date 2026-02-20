import { findVersionsByUrl } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return Response.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const versions = await findVersionsByUrl(url);
    return Response.json({ versions });
  } catch (error) {
    console.error("Versions fetch error:", error);
    return Response.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}
