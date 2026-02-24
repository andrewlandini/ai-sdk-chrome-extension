import { generateText } from "ai";
import { getPromptNodeBySlug, getPronunciationDict } from "@/lib/db";

export const maxDuration = 120;

const FALLBACK_STYLE_PROMPT = "You are an audio script generator. Apply performance direction to the script. Output ONLY the final script.";

const INWORLD_TTS_TIPS = `
## InWorld AI TTS Best Practices

You are styling a script for InWorld AI TTS. Apply these techniques to produce natural, high-quality speech:

**Punctuation & Emphasis:**
- Use exclamation points (!) to make the voice more emphatic and excited.
- Use periods to insert natural pauses. Always include punctuation at the end of sentences.
- Surround words with asterisks for emphasis: "We *need* a beach vacation" stresses "need".

**Natural, Conversational Speech:**
- Insert filler words like "uh", "um", "well", "like", "you know" to sound more human and conversational.
  - Instead of: "I'm not too sure about that."
  - Write: "Uh, I'm not uh too sure about that."

**Audio Markups (use sparingly):**
- Add non-verbal vocalizations: [sigh], [breathe], [clear_throat], [laugh], [cough]
- Choose contextually appropriate markups -- don't contradict the text's emotion.
- Place emotion/delivery markups at the beginning of a segment: [excited] This is amazing!
- Don't mix conflicting markups (e.g. [angry] with [yawn]).
- If a segment needs different emotions, break it into separate chunks.

**Text Normalization:**
- Spell out complex text that might be mispronounced:
  - Phone numbers: "(123)456-7891" -> "one two three, four five six, seven eight nine one"
  - Dates: "5/6/2025" -> "may sixth twenty twenty five"
  - Times: "12:55 PM" -> "twelve fifty-five PM"
  - Emails: "test@example.com" -> "test at example dot com"
  - Money: "$5,342.29" -> "five thousand three hundred and forty two dollars and twenty nine cents"
  - Symbols: "2+2=4" -> "two plus two equals four"

**Important:**
- Output ONLY the final styled script text. No explanations or commentary.
- Keep the script's meaning and content intact while applying these performance techniques.
`;

const VERBATIM_RULE = `
## CRITICAL: Verbatim Script Rule

You MUST keep the sentence structure, word order, and phrasing **exactly** as the original script. Do NOT rephrase, reorder, add new sentences, or restructure paragraphs.

Your ONLY allowed modifications are:
1. **Numbers** → spell them out for speech ("2025" → "twenty twenty-five", "42%" → "forty-two percent")
2. **Dates** → spoken form ("5/6/2025" → "May sixth, twenty twenty-five")
3. **Abbreviations/Acronyms** → expand or spell out ("API" → "A P I", "Edu" → "Education", "CEO" → "C E O")
4. **Symbols & math** → spoken equivalents ("$5,342" → "five thousand three hundred forty-two dollars", "+" → "plus")
5. **URLs/emails** → spoken form ("example.com" → "example dot com")
6. **Code blocks/diagrams** → replace with a brief spoken summary describing what it shows
7. **Pronunciation dictionary** → apply exact replacements from the dictionary below (if provided)
8. **Performance tags** → you may add voice direction tags like [pause], [confident], etc. but NEVER change the actual words

Everything else stays EXACTLY as written. The listener should hear the same content in the same order.
`;

export async function POST(request: Request) {
  try {
    const { script, styleInstructions, ttsProvider = "elevenlabs" } = await request.json();

    if (!script?.trim()) {
      return Response.json({ error: "Script is required" }, { status: 400 });
    }

    // Load prompt from DB
    const node = await getPromptNodeBySlug("style_agent");
    const rawPrompt = node?.user_prompt || node?.default_prompt || FALLBACK_STYLE_PROMPT;
    const styleModel = node?.model || "openai/gpt-4o";

    // Inject the user's style cue into the {{STYLE_CUE}} placeholder if present
    const styleCue = styleInstructions?.trim() || "";
    const systemPrompt = rawPrompt.includes("{{STYLE_CUE}}")
      ? rawPrompt.replace("{{STYLE_CUE}}", styleCue || "Apply natural, engaging performance direction.")
      : styleCue
        ? `${rawPrompt}\n\n**STYLE CUE FROM USER:**\n"${styleCue}"`
        : rawPrompt;

    // Always inject the verbatim rule
    let finalSystemPrompt = systemPrompt + `\n\n${VERBATIM_RULE}`;

    // Append InWorld-specific TTS tips when using InWorld provider
    if (ttsProvider === "inworld") {
      finalSystemPrompt += `\n\n${INWORLD_TTS_TIPS}`;
    }

    // Fetch and inject pronunciation dictionary
    try {
      const dictEntries = await getPronunciationDict();
      if (dictEntries.length > 0) {
        const dictLines = dictEntries.map(e => `- "${e.original}" → "${e.pronunciation}"`).join("\n");
        finalSystemPrompt += `\n\n## Pronunciation Dictionary\nApply these EXACT replacements whenever the original word/phrase appears in the script:\n${dictLines}`;
      }
    } catch (err) {
      console.error("Failed to load pronunciation dictionary:", err);
    }

    const userPrompt = `Here is the script to style:\n\n${script}`;

    const { text: styledScript } = await generateText({
      model: styleModel,
      system: finalSystemPrompt,
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
