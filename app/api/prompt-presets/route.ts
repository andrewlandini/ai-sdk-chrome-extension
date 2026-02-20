import {
  getAllPromptPresets,
  insertPromptPreset,
  updatePromptPreset,
  setDefaultPromptPreset,
  deletePromptPreset,
} from "@/lib/db";

export async function GET() {
  try {
    const presets = await getAllPromptPresets();
    return Response.json({ presets });
  } catch (error) {
    console.error("Prompt presets fetch error:", error);
    return Response.json({ error: "Failed to fetch prompt presets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, system_prompt, test_prompt, is_default } = await request.json();
    if (!name || !system_prompt || !test_prompt) {
      return Response.json({ error: "name, system_prompt, and test_prompt are required" }, { status: 400 });
    }
    const preset = await insertPromptPreset({ name, system_prompt, test_prompt, is_default });
    return Response.json({ preset });
  } catch (error) {
    console.error("Prompt preset create error:", error);
    return Response.json({ error: "Failed to create preset" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, system_prompt, test_prompt, setDefault } = await request.json();
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    if (setDefault) {
      await setDefaultPromptPreset(id);
      const presets = await getAllPromptPresets();
      return Response.json({ presets });
    }

    if (!name || !system_prompt || !test_prompt) {
      return Response.json({ error: "name, system_prompt, and test_prompt required" }, { status: 400 });
    }
    const preset = await updatePromptPreset(id, { name, system_prompt, test_prompt });
    return Response.json({ preset });
  } catch (error) {
    console.error("Prompt preset update error:", error);
    return Response.json({ error: "Failed to update preset" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    await deletePromptPreset(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Prompt preset delete error:", error);
    return Response.json({ error: "Failed to delete preset" }, { status: 500 });
  }
}
