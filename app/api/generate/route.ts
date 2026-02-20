import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put } from "@vercel/blob";
import { insertBlogAudio } from "@/lib/db";

export const maxDuration = 300;

const MODEL = "eleven_v3";
const MAX_CHARS = 4800; // leave headroom under 5000 limit

/**
 * Split text into chunks at sentence boundaries, each under MAX_CHARS.
 */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHARS) {
      chunks.push(remaining);
      break;
    }

    // Find last sentence boundary within limit
    const slice = remaining.slice(0, MAX_CHARS);
    let splitAt = -1;

    // Try splitting at sentence endings: . ! ? followed by space/newline
    for (let i = slice.length - 1; i >= Math.floor(MAX_CHARS * 0.5); i--) {
      if (
        (slice[i] === "." || slice[i] === "!" || slice[i] === "?") &&
        (i + 1 >= slice.length || slice[i + 1] === " " || slice[i + 1] === "\n")
      ) {
        splitAt = i + 1;
        break;
      }
    }

    // Fallback: split at last space
    if (splitAt === -1) {
      splitAt = slice.lastIndexOf(" ");
    }

    // Worst case: hard split
    if (splitAt <= 0) {
      splitAt = MAX_CHARS;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}

/**
 * Concatenate multiple audio buffers into one.
 */
function concatAudioBuffers(buffers: Buffer[]): Buffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = Buffer.alloc(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    buf.copy(result, offset);
    offset += buf.length;
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      url,
      title,
      summary,
      voiceId = "TX3LPaxmHKxFdv7VOQHJ",
      stability,
      label,
    } = body;

    if (!url || !summary) {
      return Response.json(
        { error: "URL and summary are required" },
        { status: 400 }
      );
    }

    // Build voice settings (v3 only uses stability)
    const voiceSettings: Record<string, number> = {};
    if (stability !== undefined) voiceSettings.stability = stability;

    const providerOpts = Object.keys(voiceSettings).length > 0
      ? { providerOptions: { elevenlabs: { voiceSettings } } }
      : {};

    // Split into chunks for v3's 5,000 char limit
    const chunks = chunkText(summary);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      const { audio } = await generateSpeech({
        model: elevenlabs.speech(MODEL),
        text: chunk,
        voice: voiceId,
        ...providerOpts,
      });
      audioBuffers.push(Buffer.from(audio.uint8Array));
    }

    // Concatenate all chunks
    const finalAudio = concatAudioBuffers(audioBuffers);

    // Upload to Vercel Blob
    const timestamp = Date.now();
    const slug = (title || "audio").substring(0, 50).replace(/[^a-zA-Z0-9]/g, "-");
    const versionLabel = label || `v${timestamp}`;
    const filename = `blog-audio/${timestamp}-${slug}-${versionLabel}.mp3`;
    const blob = await put(filename, finalAudio, {
      access: "public",
      contentType: "audio/mpeg",
    });

    // Save to database
    const entry = await insertBlogAudio({
      url,
      title: title || "Untitled",
      summary,
      audio_url: blob.url,
      voice_id: voiceId,
      model_id: MODEL,
      stability,
      label: versionLabel,
    });

    return Response.json({
      entry,
      chunks: chunks.length,
      totalChars: summary.length,
    });
  } catch (error) {
    console.error("Generate error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return Response.json({ error: message }, { status: 500 });
  }
}
