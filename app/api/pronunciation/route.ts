import { NextResponse } from "next/server";
import {
  getPronunciationDict,
  insertPronunciationEntry,
  updatePronunciationEntry,
  deletePronunciationEntry,
} from "@/lib/db";

export async function GET() {
  try {
    const entries = await getPronunciationDict();
    return NextResponse.json({ entries });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load pronunciation dictionary" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { original, pronunciation, category } = await request.json();
    if (!original?.trim() || !pronunciation?.trim()) {
      return NextResponse.json({ error: "Both original and pronunciation are required" }, { status: 400 });
    }
    const entry = await insertPronunciationEntry({
      original: original.trim(),
      pronunciation: pronunciation.trim(),
      category: category || "general",
    });
    return NextResponse.json({ entry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to add entry";
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      return NextResponse.json({ error: `"${(await request.json().catch(() => ({}))).original}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, original, pronunciation, category } = await request.json();
    if (!id || !original?.trim() || !pronunciation?.trim()) {
      return NextResponse.json({ error: "id, original, and pronunciation are required" }, { status: 400 });
    }
    const entry = await updatePronunciationEntry(id, {
      original: original.trim(),
      pronunciation: pronunciation.trim(),
      category: category || "general",
    });
    return NextResponse.json({ entry });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deletePronunciationEntry(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete entry" },
      { status: 500 }
    );
  }
}
