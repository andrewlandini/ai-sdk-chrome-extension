import { NextResponse } from "next/server";

export const maxDuration = 30;

const INWORLD_MODEL = "inworld-tts-1.5-max";
const SAMPLE_TEXT =
  "Hey there, welcome! Here's a quick preview of what I sound like. Pretty cool, right?";

/**
 * GET /api/inworld-preview?voiceId=Alex
 * Synthesizes a short preview clip for the given InWorld voice and returns MP3 audio.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get("voiceId");

  if (!voiceId) {
    return NextResponse.json({ error: "Missing voiceId" }, { status: 400 });
  }

  const credential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
  if (!credential) {
    return NextResponse.json(
      { error: "INWORLD_RUNTIME_BASE64_CREDENTIAL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credential}`,
      },
      body: JSON.stringify({
        text: SAMPLE_TEXT,
        voiceId,
        modelId: INWORLD_MODEL,
        applyTextNormalization: "ON",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `InWorld TTS error (${res.status}): ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const audioBuffer = Buffer.from(data.audioContent, "base64");

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        // Cache for 24 hours -- previews don't change often
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
