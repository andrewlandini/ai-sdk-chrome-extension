import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put, del } from "@vercel/blob";
import { sql, insertChunkVersion, updateBlogAudioChunkMap, type ChunkMapEntry } from "@/lib/db";

export const maxDuration = 120;

const MODEL = "eleven_v3";
const INWORLD_MODEL = "inworld-tts-1.5-max";

/**
 * Synthesize speech via InWorld AI TTS API.
 * Endpoint: POST https://api.inworld.ai/tts/v1/voice
 * Max input: 2,000 characters per request.
 * Response: JSON with base64-encoded audioContent.
 */
async function inworldSynthesize(text: string, voiceId: string): Promise<Buffer> {
  const credential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
  if (!credential) throw new Error("INWORLD_RUNTIME_BASE64_CREDENTIAL is not configured");

  const res = await fetch("https://api.inworld.ai/tts/v1/voice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credential}`,
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId: INWORLD_MODEL,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`InWorld TTS API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return Buffer.from(data.audioContent, "base64");
}

/**
 * Estimate MP3 audio duration in ms from a buffer.
 */
function estimateMp3DurationMs(buf: Buffer): number {
  // Find first sync frame
  let frameStart = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      frameStart = i;
      break;
    }
  }
  if (frameStart >= buf.length - 4) return (buf.length * 8) / 128;
  const header = buf.readUInt32BE(frameStart);
  const bitrateIndex = (header >> 12) & 0x0f;
  const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const bitrate = bitrateTable[bitrateIndex] || 128;
  const dataSize = buf.length - frameStart;
  return (dataSize * 8) / bitrate;
}

/**
 * Find the first MP3 sync frame, skip ID3 tags.
 */
function findFirstFrame(buf: Buffer): number {
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) return i;
  }
  return 0;
}

/**
 * Concatenate MP3 buffers. First keeps headers, rest are stripped to raw frames.
 */
function concatMp3Buffers(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];
  const parts: Buffer[] = [buffers[0]];
  for (let i = 1; i < buffers.length; i++) {
    const start = findFirstFrame(buffers[i]);
    parts.push(buffers[i].subarray(start));
  }
  return Buffer.concat(parts);
}

/**
 * POST /api/generate-chunk
 * Re-generates a single chunk's audio, stitches all chunks back together,
 * and updates the blog_audio entry.
 */
export async function POST(request: Request) {
  try {
    const { blogAudioId, chunkIndex, newText, voiceId, stability, ttsProvider = "elevenlabs" } = await request.json();

    if (!blogAudioId || chunkIndex === undefined || !newText?.trim()) {
      return Response.json({ error: "blogAudioId, chunkIndex, and newText are required" }, { status: 400 });
    }

    // Load the existing entry
    const rows = await sql`SELECT * FROM blog_audio WHERE id = ${blogAudioId}`;
    if (rows.length === 0) {
      return Response.json({ error: "Entry not found" }, { status: 404 });
    }
    const entry = rows[0];
    const chunkMap: ChunkMapEntry[] = entry.chunk_map as ChunkMapEntry[] || [];
    if (chunkMap.length === 0) {
      return Response.json({ error: "No chunk_map on this entry" }, { status: 400 });
    }

    const targetChunk = chunkMap.find(c => c.index === chunkIndex);
    if (!targetChunk) {
      return Response.json({ error: `Chunk index ${chunkIndex} not found` }, { status: 404 });
    }

    // Generate new audio for the chunk
    const useVoice = voiceId || entry.voice_id || "PIGsltMj3gFMR34aFDI3";
    let newBuf: Buffer;

    if (ttsProvider === "inworld") {
      newBuf = await inworldSynthesize(newText, useVoice);
    } else {
      const providerOpts = stability !== undefined
        ? { providerOptions: { elevenlabs: { voiceSettings: { stability } } } }
        : {};

      const { audio } = await generateSpeech({
        model: elevenlabs.speech(MODEL),
        text: newText,
        voice: useVoice,
        ...providerOpts,
      });
      newBuf = Buffer.from(audio.uint8Array);
    }
    const newDurationMs = estimateMp3DurationMs(newBuf);

    // Upload new chunk blob
    const slug = (entry.label as string) || `audio-${blogAudioId}`;
    const chunkFilename = `blog-audio/${slug}-chunk-${String(chunkIndex).padStart(3, "0")}-regen-${Date.now()}.mp3`;
    const chunkBlob = await put(chunkFilename, newBuf, {
      access: "public",
      contentType: "audio/mpeg",
    });

    // Save chunk version history
    await insertChunkVersion({
      blog_audio_id: blogAudioId,
      chunk_index: chunkIndex,
      text: newText,
      audio_blob_url: chunkBlob.url,
      duration_ms: newDurationMs,
    });

    // Delete old chunk blob (best effort)
    try { await del(targetChunk.blobUrl); } catch { /* best effort */ }

    // Update chunk map with new text, blob, and duration
    let cumulativeTime = 0;
    const newChunkMap: ChunkMapEntry[] = chunkMap.map(c => {
      const text = c.index === chunkIndex ? newText : c.text;
      const durationMs = c.index === chunkIndex ? newDurationMs : c.durationMs;
      const blobUrl = c.index === chunkIndex ? chunkBlob.url : c.blobUrl;
      const startTime = cumulativeTime;
      const endTime = cumulativeTime + durationMs / 1000;
      cumulativeTime = endTime;
      return { index: c.index, text, startTime, endTime, durationMs, blobUrl };
    });

    // Re-stitch all chunk blobs into new combined MP3
    const chunkBuffers: Buffer[] = [];
    for (const c of newChunkMap) {
      if (c.index === chunkIndex) {
        chunkBuffers.push(newBuf);
      } else {
        const res = await fetch(c.blobUrl);
        const arrayBuf = await res.arrayBuffer();
        chunkBuffers.push(Buffer.from(arrayBuf));
      }
    }
    const finalAudio = concatMp3Buffers(chunkBuffers);

    // Upload new combined blob
    const combinedFilename = `blog-audio/${slug}-combined-${Date.now()}.mp3`;
    const combinedBlob = await put(combinedFilename, finalAudio, {
      access: "public",
      contentType: "audio/mpeg",
    });

    // Delete old combined blob (best effort)
    try { await del(entry.audio_url as string); } catch { /* best effort */ }

    // Build new summary from all chunk texts
    const newSummary = newChunkMap.map(c => c.text).join("\n\n");

    // Update the DB entry
    const updated = await updateBlogAudioChunkMap(
      blogAudioId,
      newChunkMap,
      combinedBlob.url,
      newSummary,
    );

    return Response.json({ entry: updated, chunkMap: newChunkMap });
  } catch (err) {
    console.error("Generate-chunk error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to re-generate chunk" },
      { status: 500 },
    );
  }
}
