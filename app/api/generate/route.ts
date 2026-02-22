import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put, del } from "@vercel/blob";
import { insertBlogAudio, getAudioIdByUrl, getGenerationCountByUrl, createGenerationJob, updateGenerationJob, upsertCachedCredits, type ChunkMapEntry } from "@/lib/db";

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
 * Split text into paragraph-level chunks. Each paragraph (\n\n separated)
 * becomes its own chunk for the chunk_map, so users can edit per-paragraph.
 * If a single paragraph exceeds MAX_CHARS, it gets sub-split on sentence
 * boundaries, but each sub-split is still its own chunk.
 */
function chunkByParagraph(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= MAX_CHARS) {
      result.push(para);
    } else {
      // Sub-split oversized paragraphs on sentence boundaries
      const sentences = para.match(/[^.!?]*[.!?]+[\s]*/g) || [para];
      let current = "";
      for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;
        const combined = current ? `${current} ${trimmed}` : trimmed;
        if (combined.length <= MAX_CHARS) {
          current = combined;
        } else {
          if (current) result.push(current);
          current = trimmed;
        }
      }
      if (current) result.push(current);
    }
  }
  return result.length > 0 ? result : [text];
}

/**
 * Estimate MP3 audio duration in milliseconds from a buffer.
 * ElevenLabs outputs CBR MP3 at 128kbps typically. We parse the first frame
 * to get the actual bitrate and sample rate, then calculate from buffer size.
 */
function estimateMp3DurationMs(buf: Buffer): number {
  const frameStart = findFirstFrame(buf);
  if (frameStart >= buf.length - 4) {
    // Fallback: assume 128kbps CBR
    return (buf.length * 8) / 128;
  }
  const header = buf.readUInt32BE(frameStart);
  const bitrateIndex = (header >> 12) & 0x0f;
  const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const bitrate = bitrateTable[bitrateIndex] || 128;
  // Duration = (fileSize * 8) / (bitrate * 1000) * 1000 ms
  const dataSize = buf.length - frameStart;
  return (dataSize * 8) / bitrate;
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
  const body = await request.json();
  const {
    url,
    title,
    summary,
    voiceId = "TX3LPaxmHKxFdv7VOQHJ",
    stability,
  } = body;

  if (!url || !summary) {
    return Response.json(
      { error: "URL and summary are required" },
      { status: 400 }
    );
  }

  // Create a job record so the client can poll for status after refresh
  let job;
  try {
    job = await createGenerationJob(url, title || "Untitled");
  } catch (err) {
    console.error("Failed to create generation job:", err);
    return Response.json({ error: "Failed to start generation job" }, { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      // Send the job ID immediately so client can poll
      send({ type: "job", jobId: job.id });

      try {
        await updateGenerationJob(job.id, { status: "generating", message: "Starting generation..." });
        // Build provider options (only include voiceSettings if stability was provided)
        const voiceSettings: Record<string, number> = {};
        if (stability !== undefined) voiceSettings.stability = stability;

        const providerOpts = Object.keys(voiceSettings).length > 0
          ? { providerOptions: { elevenlabs: { voiceSettings } } }
          : {};

        // Split into chunks for v3's character limit
        const chunks = chunkByParagraph(summary);
        const totalChars = summary.length;
        const voiceName = VOICE_MAP[voiceId] || "Unknown";

        send({
          type: "status",
          step: "chunking",
          message: chunks.length === 1
            ? `Preparing script (${totalChars.toLocaleString()} chars) for ${voiceName}...`
            : `Split into ${chunks.length} chunks (${totalChars.toLocaleString()} chars) for ${voiceName}`,
        });

        const audioBuffers: Buffer[] = [];
        const chunkDurations: number[] = []; // ms per chunk

        for (let i = 0; i < chunks.length; i++) {
          const chunkChars = chunks[i].length;
          send({
            type: "status",
            step: "generating",
            message: chunks.length === 1
              ? `Generating speech with ElevenLabs v3...`
              : `Generating chunk ${i + 1}/${chunks.length} (${chunkChars.toLocaleString()} chars)...`,
            progress: { current: i + 1, total: chunks.length },
          });

          const { audio } = await generateSpeech({
            model: elevenlabs.speech(MODEL),
            text: chunks[i],
            voice: voiceId,
            ...providerOpts,
          });
          const buf = Buffer.from(audio.uint8Array);
          audioBuffers.push(buf);
          chunkDurations.push(estimateMp3DurationMs(buf));
        }

        // Concatenate chunks
        if (chunks.length > 1) {
          send({ type: "status", step: "combining", message: "Combining audio chunks..." });
        }
        const finalAudio = concatMp3Buffers(audioBuffers);

        // Upload to Vercel Blob
        await updateGenerationJob(job.id, { status: "uploading", message: "Uploading to storage..." });
        send({ type: "status", step: "uploading", message: "Uploading to storage..." });

        const postSlug = await getAudioIdByUrl(url);
        const genCount = await getGenerationCountByUrl(url);
        const genNum = String(genCount + 1).padStart(3, "0");
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

        // Upload individual chunk blobs and build chunk_map
        const chunkMap: ChunkMapEntry[] = [];
        let cumulativeTime = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunkFilename = `blog-audio/${slug}-gen-${genNum}-chunk-${String(i).padStart(3, "0")}.mp3`;
          const chunkBlob = await put(chunkFilename, audioBuffers[i], {
            access: "public",
            contentType: "audio/mpeg",
          });
          const durationSec = chunkDurations[i] / 1000;
          chunkMap.push({
            index: i,
            text: chunks[i],
            startTime: cumulativeTime,
            endTime: cumulativeTime + durationSec,
            durationMs: chunkDurations[i],
            blobUrl: chunkBlob.url,
          });
          cumulativeTime += durationSec;
        }

        // Save to database
        send({ type: "status", step: "saving", message: "Saving to database..." });

        const versionNum = genCount + 1;
        const versionLabel = `${slug}_v${versionNum}`;

        let entry;
        try {
          entry = await insertBlogAudio({
            url,
            title: title || "Untitled",
            summary,
            audio_url: blob.url,
            voice_id: voiceId,
            model_id: MODEL,
            stability,
            label: versionLabel,
            chunk_map: chunkMap,
          });
        } catch (dbErr) {
          // Clean up orphaned blob if DB insert fails
          try { await del(blob.url); } catch { /* best effort */ }
          throw dbErr;
        }

        await updateGenerationJob(job.id, { status: "done", message: "Complete", result_entry_id: entry.id });

        // Refresh credits from ElevenLabs and save to DB
        try {
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (apiKey) {
            const creditsRes = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
              headers: { "xi-api-key": apiKey },
            });
            if (creditsRes.ok) {
              const creditsData = await creditsRes.json();
              await upsertCachedCredits({
                tier: creditsData.tier,
                characterCount: creditsData.character_count,
                characterLimit: creditsData.character_limit,
                nextResetUnix: creditsData.next_character_count_reset_unix,
              });
            }
          }
        } catch { /* best effort credits refresh */ }

        send({
          type: "done",
          entry,
          chunks: chunks.length,
          totalChars,
        });

        controller.close();
      } catch (error) {
        console.error("Generate error:", error);
        const message =
          error instanceof Error ? error.message : "An unexpected error occurred";
        await updateGenerationJob(job.id, { status: "error", message }).catch(() => {});
        send({ type: "error", error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
