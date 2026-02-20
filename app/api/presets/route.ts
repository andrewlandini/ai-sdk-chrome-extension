import { NextResponse } from "next/server";
import { getAllPresets, insertPreset, deletePreset } from "@/lib/db";

export async function GET() {
  try {
    const presets = await getAllPresets();
    return NextResponse.json({ presets });
  } catch (error) {
    console.error("Error fetching presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch presets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, voice_id, stability } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Preset name is required" },
        { status: 400 }
      );
    }

    const preset = await insertPreset({
      name: name.trim(),
      voice_id,
      stability,
    });

    return NextResponse.json({ preset });
  } catch (error) {
    console.error("Error saving preset:", error);
    return NextResponse.json(
      { error: "Failed to save preset" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await deletePreset(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting preset:", error);
    return NextResponse.json(
      { error: "Failed to delete preset" },
      { status: 500 }
    );
  }
}
