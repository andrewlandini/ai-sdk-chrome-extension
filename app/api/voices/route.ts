import { NextResponse } from "next/server";

export const maxDuration = 30;

// Curated v3 voice IDs we actually show in the UI
const ALLOWED_IDS = new Set([
  "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "nPczCjzI2devNBz1zQrb", // Brian
  "JBFqnCBsd6RMkjVDRZzb", // George
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "pFZP5JQG7iQjIQuC4Bku", // Lily
  "21m00Tcm4TlvDq8ikWAM", // Rachel
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "IKne3meq5aSn9XLyUdCD", // Charlie
  "cjVigY5qzO86Huf0OWal", // Eric
  "N2lVS1w4EtoT3dr4eOWO", // Callum
  "iP95p4xoKVk53GoZ742B", // Chris
]);

export async function GET() {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch voices" }, { status: res.status });
    }

    const data = await res.json();
    const voices: Record<string, string> = {};

    for (const voice of data.voices ?? []) {
      if (ALLOWED_IDS.has(voice.voice_id) && voice.preview_url) {
        voices[voice.voice_id] = voice.preview_url;
      }
    }

    // Fallback for any allowed voices not found in user's library:
    // try fetching them directly by ID
    for (const id of ALLOWED_IDS) {
      if (!voices[id]) {
        try {
          const directRes = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
            headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
          });
          if (directRes.ok) {
            const directData = await directRes.json();
            if (directData.preview_url) {
              voices[id] = directData.preview_url;
            }
          }
        } catch {
          // skip
        }
      }
    }

    return NextResponse.json({ voices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
