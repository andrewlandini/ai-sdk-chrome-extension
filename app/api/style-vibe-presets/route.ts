import { getStyleVibePresets, updateStyleVibePreset, resetStyleVibePreset } from "@/lib/db";

export async function GET() {
  try {
    const presets = await getStyleVibePresets();
    return Response.json({ presets });
  } catch (error) {
    console.error("Failed to fetch style vibe presets:", error);
    return Response.json({ error: "Failed to fetch presets" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, userPrompt } = await request.json();
    if (!id || typeof userPrompt !== "string") {
      return Response.json({ error: "id and userPrompt are required" }, { status: 400 });
    }
    const preset = await updateStyleVibePreset(id, userPrompt);
    return Response.json({ preset });
  } catch (error) {
    console.error("Failed to update style vibe preset:", error);
    return Response.json({ error: "Failed to update preset" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    const preset = await resetStyleVibePreset(id);
    return Response.json({ preset });
  } catch (error) {
    console.error("Failed to reset style vibe preset:", error);
    return Response.json({ error: "Failed to reset preset" }, { status: 500 });
  }
}
