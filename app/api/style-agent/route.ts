import { generateText } from "ai";
import { getPromptNodeBySlug } from "@/lib/db";

export const maxDuration = 120;

const FALLBACK_STYLE_PROMPT = "You are an audio script generator. Apply performance direction to the script. Output ONLY the final script.";

export async function POST(request: Request) {
  try {
    const { script, styleInstructions } = await request.json();

    if (!script?.trim()) {
      return Response.json({ error: "Script is required" }, { status: 400 });
    }

    // Load prompt from DB
    const node = await getPromptNodeBySlug("style_agent");
    const systemPrompt = node?.user_prompt || node?.default_prompt || FALLBACK_STYLE_PROMPT;
    const styleModel = node?.model || "openai/gpt-4o";

    const userPrompt = styleInstructions?.trim()
      ? `The user wants the following style/vibe applied:\n"${styleInstructions}"\n\nHere is the script to style:\n\n${script}`
      : `Apply natural, engaging performance direction to this script:\n\n${script}`;

    const { text: styledScript } = await generateText({
      model: styleModel,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return Response.json({ styledScript });
  } catch (err) {
    console.error("Style agent error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Style agent failed" },
      { status: 500 }
    );
  }
}
