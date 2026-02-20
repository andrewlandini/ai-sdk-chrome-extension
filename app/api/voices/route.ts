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
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch voices" }, { status: res.status });
    }

    const data = await res.json();
    const voices: Record<string, string> = {};

    for (const voice of data.voices ?? []) {
      if (ALLOWED_IDS.has(voice.voice_id)) {
        console.log("[v0] Voice:", voice.voice_id, voice.name, "preview_url:", voice.preview_url ?? "MISSING", "keys:", Object.keys(voice).join(","));
        if (voice.preview_url) {
          voices[voice.voice_id] = voice.preview_url;
        }
      }
    }
    console.log("[v0] Total allowed voices found:", Object.keys(voices).length, "IDs:", Object.keys(voices));

    // Fallback: if Rachel wasn't found (premade voice may not be in library),
    // try fetching her directly
    if (!voices["21m00Tcm4TlvDq8ikWAM"]) {
      try {
        const rachelRes = await fetch("https://api.elevenlabs.io/v1/voices/21m00Tcm4TlvDq8ikWAM", {
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
        });
        if (rachelRes.ok) {
          const rachelData = await rachelRes.json();
          console.log("[v0] Rachel direct fetch - preview_url:", rachelData.preview_url ?? "MISSING");
          if (rachelData.preview_url) {
            voices["21m00Tcm4TlvDq8ikWAM"] = rachelData.preview_url;
          }
        }
      } catch (e) {
        console.log("[v0] Rachel direct fetch failed:", e);
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
