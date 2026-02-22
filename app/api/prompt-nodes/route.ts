import { NextRequest, NextResponse } from "next/server";
import {
  getAllPromptNodes,
  getPromptNodeHistory,
  updatePromptNode,
  resetPromptNode,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");
    const history = req.nextUrl.searchParams.get("history");

    if (slug && history) {
      const entries = await getPromptNodeHistory(slug);
      return NextResponse.json(entries);
    }

    const nodes = await getAllPromptNodes();
    return NextResponse.json(nodes);
  } catch (e) {
    console.error("Error fetching prompt nodes:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { slug, user_prompt, model, reset } = await req.json();
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    if (reset) {
      const node = await resetPromptNode(slug);
      return NextResponse.json(node);
    }

    const node = await updatePromptNode(slug, {
      user_prompt: user_prompt ?? null,
      model: model ?? "openai/gpt-4o",
    });
    return NextResponse.json(node);
  } catch (e) {
    console.error("Error updating prompt node:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
