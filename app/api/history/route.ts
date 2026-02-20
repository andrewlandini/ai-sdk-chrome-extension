import { getAllBlogAudio } from "@/lib/db";

export async function GET() {
  try {
    const entries = await getAllBlogAudio();
    return Response.json({ entries });
  } catch (error) {
    console.error("History fetch error:", error);
    return Response.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
