import { experimental_generateSpeech as generateSpeech, generateObject } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { put, del } from "@vercel/blob";
import { z } from "zod";
import { insertBlogAudio, getAudioIdByUrl, getGenerationCountByUrl, createGenerationJob, updateGenerationJob, upsertCachedCredits, type ChunkMapEntry } from "@/lib/db";

export const maxDuration = 300;

const MODEL = "eleven_v3";
const MAX_CHARS = 4000;

// Voice map is no longer hardcoded; names are resolved dynamically via /api/voices

/**
 * Use an AI model to intelligently segment a styled script into logical
 * audio chunks. Each chunk should be a semantically complete section --
 * a full thought, list with its intro, or cohesive paragraph.
 * Falls back to simple splitting if the AI call fails.
 */
async function segmentWithAI(text: string): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: "openai/gpt-4o-mini" as any,
      schema: z.object({
        segments: z.array(z.string()).describe("Array of script segments, each a semantically complete section"),
      }),
      system: `You are a script segmentation expert. Your job is to split a voice-over script into logical audio segments for text-to-speech generation.

Rules:
- Each segment MUST contain multiple sentences (at least 2-3). A segment must NEVER be a single sentence on its own.
- Each segment must be a COMPLETE thought or section. Never split mid-sentence or separate a header from its list/body.
- If a line introduces a list (e.g. "Key components include:"), keep ALL list items WITH the intro as ONE segment.
- If a paragraph is short (1-2 sentences), merge it with the next related paragraph into one segment.
- Voice direction tags like [confident], [calm], [pause], etc. are part of the text -- keep them in place.
- Aim for 3-8 segments depending on script length. Fewer, longer segments are better than many tiny ones.
- Each segment must be under ${MAX_CHARS} characters. If a logical section is longer, split at a natural paragraph or topic boundary -- never mid-sentence.
- Preserve the EXACT text -- do not rephrase, reorder, add, or remove any words or tags.
- The concatenation of all segments must exactly equal the original text (with whitespace trimming allowed between segments).`,
      prompt: text,
    });
    // Validate: segments should cover the full text
    if (object.segments && object.segments.length > 0) {
      // Filter empty segments
      const segments = object.segments.map(s => s.trim()).filter(Boolean);
      if (segments.length > 0) return segments;
    }
    return fallbackChunk(text);
  } catch (err) {
    console.error("AI segmentation failed, using fallback:", err);
    return fallbackChunk(text);
  }
}

/** Simple fallback: split on paragraph breaks, merge short fragments so no segment is a single sentence */
function fallbackChunk(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return [text.trim()];
  const result: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    // Count sentences (rough: split on . ! ? followed by space or end)
    const sentenceCount = (current.match(/[.!?](?:\s|$)/g) || []).length;
    // Merge if current chunk is short or only has 1 sentence
    if (current && (current.length < 200 || sentenceCount < 2)) {
      current = current + " " + para;
    } else {
      if (current) result.push(current);
      current = para;
    }
  }
  if (current) result.push(current);
  return result.length > 0 ? result : [text.trim()];
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

/**
 * Synthesize speech via InWorld AI TTS API.
 * Returns an MP3 buffer.
 */
async function inworldSynthesize(text: string, voiceId: string): Promise<Buffer> {
  const credential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
  if (!credential) throw new Error("INWORLD_RUNTIME_BASE64_CREDENTIAL is not configured");

  const res = await fetch("https://api.inworld.ai/tts/v1/synthesize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credential}`,
    },
    body: JSON.stringify({
      text,
      voiceId,
      outputFormat: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`InWorld TTS API error (${res.status}): ${errText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    url,
    title,
    summary,
    voiceId = "PIGsltMj3gFMR34aFDI3",
    stability,
    ttsProvider = "elevenlabs",
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

        // Intelligently segment the script using AI
        send({ type: "status", step: "segmenting", message: "Analyzing script for optimal audio segments..." });
        const chunks = await segmentWithAI(summary);
        const totalChars = summary.length;
        const voiceName = voiceId.slice(0, 8);

        send({
          type: "status",
          step: "chunking",
          message: chunks.length === 1
            ? `Preparing script (${totalChars.toLocaleString()} chars) for ${voiceName}...`
            : `Split into ${chunks.length} chunks (${totalChars.toLocaleString()} chars) for ${voiceName}`,
        });

        const audioBuffers: Buffer[] = [];
        const chunkDurations: number[] = []; // ms per chunk

        // Append [short pause] to every chunk for natural breathing room between segments
        const chunksWithPause = chunks.map(c => c.trimEnd().endsWith("[short pause]") ? c : `${c.trimEnd()} [short pause]`);

        const providerLabel = ttsProvider === "inworld" ? "InWorld AI" : "ElevenLabs v3";

        for (let i = 0; i < chunks.length; i++) {
          const chunkChars = chunks[i].length;
          send({
            type: "status",
            step: "generating",
            message: chunks.length === 1
              ? `Generating speech with ${providerLabel}...`
              : `Generating chunk ${i + 1}/${chunks.length} (${chunkChars.toLocaleString()} chars)...`,
            progress: { current: i + 1, total: chunks.length },
          });

          let buf: Buffer;
          if (ttsProvider === "inworld") {
            buf = await inworldSynthesize(chunksWithPause[i], voiceId);
          } else {
            const { audio } = await generateSpeech({
              model: elevenlabs.speech(MODEL),
              text: chunksWithPause[i],
              voice: voiceId,
              ...providerOpts,
            });
            buf = Buffer.from(audio.uint8Array);
          }
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
        const versionNum = genCount + 1;
        // Build label: YYYYMMDD_first-two-words_vN
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const titleWords = (title || "untitled")
          .toLowerCase()
          .replace(/[^a-z0-9\s]+/g, "")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .join("-");
        const versionLabel = `${dateStr}_${titleWords}_v${versionNum}`;
        const blobSlug = postSlug || (title || "untitled")
          .toLowerCase()
          .substring(0, 60)
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const filename = `blog-audio/${versionLabel}.mp3`;
        const blob = await put(filename, finalAudio, {
          access: "public",
          contentType: "audio/mpeg",
        });

        // Upload individual chunk blobs and build chunk_map
        const chunkMap: ChunkMapEntry[] = [];
        let cumulativeTime = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunkFilename = `blog-audio/${versionLabel}-chunk-${String(i).padStart(3, "0")}.mp3`;
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

        let entry;
        try {
          entry = await insertBlogAudio({
            url,
            title: title || "Untitled",
            summary,
            audio_url: blob.url,
            voice_id: voiceId,
            model_id: ttsProvider === "inworld" ? "inworld" : MODEL,
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

        // Refresh credits from ElevenLabs and save to DB (skip for InWorld)
        if (ttsProvider === "elevenlabs") try {
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
        let message = "An unexpected error occurred";
        if (error instanceof Error) {
          // Extract ElevenLabs API details if present
          const errAny = error as any;
          if (errAny.statusCode || errAny.status) {
            message = `ElevenLabs API error (${errAny.statusCode || errAny.status}): ${error.message}`;
          } else {
            message = error.message;
          }
        }
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
