import { del } from "@vercel/blob";
import { deleteBlogAudio } from "@/lib/db";

export async function DELETE(request: Request) {
  try {
    const { id, audioUrl } = await request.json();

    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    // Delete from Blob storage if URL provided
    if (audioUrl) {
      try {
        await del(audioUrl);
      } catch (e) {
        console.error("Blob delete error (non-fatal):", e);
      }
    }

    // Delete from database
    await deleteBlogAudio(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return Response.json({ error: "Failed to delete" }, { status: 500 });
  }
}
