import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put } from "@vercel/blob";
import { insertBlogAudio } from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      url,
      title,
      summary,
      voiceId = "JBFqnCBsd6RMkjVDRZzb",
      modelId = "eleven_flash_v2_5",
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

    // Build provider options for ElevenLabs voice settings
    const providerOptions: Record<string, Record<string, unknown>> = {
      elevenlabs: {},
    };

    if (stability !== undefined || similarityBoost !== undefined) {
      providerOptions.elevenlabs.voiceSettings = {
        ...(stability !== undefined && { stability }),
        ...(similarityBoost !== undefined && { similarity_boost: similarityBoost }),
      };
    }

    // Generate speech with ElevenLabs
    const { audio } = await generateSpeech({
      model: elevenlabs.speech(modelId),
      text: summary,
      voice: voiceId,
      providerOptions,
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
      similarity_boost: similarityBoost,
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
