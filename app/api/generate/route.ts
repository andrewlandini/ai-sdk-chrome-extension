import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put } from "@vercel/blob";
import { insertBlogAudio } from "@/lib/db";

export const maxDuration = 120;

/**
 * Enhance text for TTS: write out numbers, symbols, and notation
 * so the model pronounces them correctly. This mirrors ElevenLabs'
 * UI-side normalization step.
 */
function enhanceText(text: string): string {
  let enhanced = text;

  // Currency symbols to words (before number processing)
  enhanced = enhanced.replace(/\$\s?([\d,]+(?:\.\d+)?)/g, (_, n) => `${n} dollars`);
  enhanced = enhanced.replace(/\u00a3\s?([\d,]+(?:\.\d+)?)/g, (_, n) => `${n} pounds`);
  enhanced = enhanced.replace(/\u20ac\s?([\d,]+(?:\.\d+)?)/g, (_, n) => `${n} euros`);
  enhanced = enhanced.replace(/\u00a5\s?([\d,]+(?:\.\d+)?)/g, (_, n) => `${n} yen`);

  // Percentage
  enhanced = enhanced.replace(/([\d,.]+)\s?%/g, "$1 percent");

  // Common abbreviations
  enhanced = enhanced.replace(/\betc\./gi, "etcetera");
  enhanced = enhanced.replace(/\be\.g\./gi, "for example");
  enhanced = enhanced.replace(/\bi\.e\./gi, "that is");
  enhanced = enhanced.replace(/\bvs\./gi, "versus");
  enhanced = enhanced.replace(/\bw\//gi, "with");

  // URLs - simplify for speech
  enhanced = enhanced.replace(/https?:\/\/(?:www\.)?([^\s/]+)(?:\/[^\s]*)?/g, (_, domain) => domain);

  // Arrows and symbols
  enhanced = enhanced.replace(/=>/g, "arrow");
  enhanced = enhanced.replace(/->/g, "to");
  enhanced = enhanced.replace(/\.\.\./g, "...");

  // Clean up extra whitespace
  enhanced = enhanced.replace(/\s{2,}/g, " ").trim();

  return enhanced;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      url,
      title,
      summary,
      voiceId = "TX3LPaxmHKxFdv7VOQHJ",
      modelId = "eleven_v3",
      stability,
      similarityBoost,
      label,
    } = body;

    if (!url || !summary) {
      return Response.json(
        { error: "URL and summary are required" },
        { status: 400 }
      );
    }

    const isV3 = modelId === "eleven_v3";

    // Always enhance the text before sending to ElevenLabs
    const processedText = enhanceText(summary);

    // Build voice settings based on model
    const voiceSettings: Record<string, number> = {};
    if (stability !== undefined) voiceSettings.stability = stability;

    // v3 only uses stability; older models also use similarity_boost
    if (!isV3 && similarityBoost !== undefined) {
      voiceSettings.similarity_boost = similarityBoost;
    }

    // Generate speech with ElevenLabs
    const { audio } = await generateSpeech({
      model: elevenlabs.speech(modelId),
      text: processedText,
      voice: voiceId,
      ...(Object.keys(voiceSettings).length > 0 && {
        providerOptions: {
          elevenlabs: { voiceSettings },
        },
      }),
    });

    // Upload to Vercel Blob
    const timestamp = Date.now();
    const slug = (title || "audio").substring(0, 50).replace(/[^a-zA-Z0-9]/g, "-");
    const versionLabel = label || `v${timestamp}`;
    const filename = `blog-audio/${timestamp}-${slug}-${versionLabel}.mp3`;
    const blob = await put(filename, Buffer.from(audio.uint8Array), {
      access: "public",
      contentType: audio.mediaType || "audio/mpeg",
    });

    // Save to database
    const entry = await insertBlogAudio({
      url,
      title: title || "Untitled",
      summary,
      audio_url: blob.url,
      voice_id: voiceId,
      model_id: modelId,
      stability,
      similarity_boost: isV3 ? null : similarityBoost,
      label: versionLabel,
    });

    return Response.json({ entry });
  } catch (error) {
    console.error("Generate error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
