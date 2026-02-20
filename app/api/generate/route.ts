import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put } from "@vercel/blob";
import { insertBlogAudio, getAudioIdByUrl, getGenerationCountByUrl } from "@/lib/db";

export const maxDuration = 300;

const MODEL = "eleven_v3";
const MAX_CHARS = 4000;

// Map voice IDs to human-readable names for filenames
const VOICE_MAP: Record<string, string> = {
  TX3LPaxmHKxFdv7VOQHJ: "Liam",
  nPczCjzI2devNBz1zQrb: "Brian",
  JBFqnCBsd6RMkjVDRZzb: "George",
  onwK4e9ZLuTAKqWW03F9: "Daniel",
  pFZP5JQG7iQjIQuC4Bku: "Lily",
  "21m00Tcm4TlvDq8ikWAM": "Rachel",
  EXAVITQu4vr4xnSDxMaL: "Sarah",
  Xb7hH8MSUJpSbSDYk0k2: "Alice",
  IKne3meq5aSn9XLyUdCD: "Charlie",
  cjVigY5qzO86Huf0OWal: "Eric",
  N2lVS1w4EtoT3dr4eOWO: "Callum",
  iP95p4xoKVk53GoZ742B: "Chris",
};

/**
 * Split text into chunks at paragraph boundaries, each under MAX_CHARS.
 * Never splits in the middle of a paragraph. If a single paragraph exceeds
 * MAX_CHARS it gets its own chunk (ElevenLabs will handle it).
 */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];

  // Split into paragraphs (double newline, or single newline with blank line)
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    // Check if adding this paragraph would exceed the limit
    const combined = current ? `${current}\n\n${para}` : para;

    if (combined.length <= MAX_CHARS) {
      // Fits -- accumulate into current chunk
      current = combined;
    } else {
      // Doesn't fit -- push current chunk (if any) and start fresh
      if (current) {
        chunks.push(current);
      }
      // Start new chunk with this paragraph (even if it exceeds MAX_CHARS
      // on its own -- never break a paragraph)
      current = para;
    }
  }

  // Push the last chunk
  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Find the first MP3 sync frame (0xFF 0xE0+) in a buffer, skipping any
 * ID3 tags or other non-frame data at the start.
 */
function findFirstFrame(buf: Buffer): number {
  for (let i = 0; i < buf.length - 1; i++) {
    // MP3 frame sync: 11 set bits = 0xFF followed by byte with top 3 bits set (0xE0+)
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      return i;
    }
  }
  return 0;
}

/**
 * Concatenate multiple MP3 buffers into one continuous stream.
 * The first buffer is kept as-is (with its headers). Subsequent buffers
 * have their ID3/metadata headers stripped so only raw MP3 frames remain,
 * preventing the player from restarting or duplicating audio at stitch points.
 */
function concatMp3Buffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  const parts: Buffer[] = [buffers[0]];

  for (let i = 1; i < buffers.length; i++) {
    const frameStart = findFirstFrame(buffers[i]);
    parts.push(buffers[i].subarray(frameStart));
  }

  return Buffer.concat(parts);
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

    // Concatenate chunks, stripping duplicate MP3 headers from chunks 2+
    const finalAudio = concatMp3Buffers(audioBuffers);

    // Upload to Vercel Blob with slug-based filenames
    const postSlug = await getAudioIdByUrl(url);
    const genCount = await getGenerationCountByUrl(url);
    const genNum = String(genCount + 1).padStart(3, "0"); // 001, 002, etc.
    const slug = postSlug || (title || "untitled")
      .toLowerCase()
      .substring(0, 60)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const filename = `blog-audio/${slug}-gen-${genNum}.mp3`;
    const blob = await put(filename, finalAudio, {
      access: "public",
      contentType: "audio/mpeg",
    });

    // Build label as slug_v1, slug_v2, etc.
    const versionNum = genCount + 1;
    const versionLabel = `${slug}_v${versionNum}`;

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
