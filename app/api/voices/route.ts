import { NextResponse } from "next/server";

export const maxDuration = 30;

// Curated voice IDs fetched from ElevenLabs library
const ALLOWED_IDS = new Set([
  // Premade voices
  "CwhRBWXzGAHq8TQ4Fs17", // Roger - Laid-Back, Casual
  "EXAVITQu4vr4xnSDxMaL", // Sarah - Mature, Confident
  "IKne3meq5aSn9XLyUdCD", // Charlie - Deep, Energetic
  "JBFqnCBsd6RMkjVDRZzb", // George - Warm Storyteller
  "TX3LPaxmHKxFdv7VOQHJ", // Liam - Energetic Creator
  "Xb7hH8MSUJpSbSDYk0k2", // Alice - Clear Educator
  "XrExE9yKIg1WjnnlVkGX", // Matilda - Professional
  "nPczCjzI2devNBz1zQrb", // Brian - Deep, Resonant
  "onwK4e9ZLuTAKqWW03F9", // Daniel - Steady Broadcaster
  "pFZP5JQG7iQjIQuC4Bku", // Lily - Velvety Actress
  "pqHfZKP75CvOlQylNhV4", // Bill - Wise, Mature
  "cgSgspJ2msm6clMCkdW9", // Jessica - Playful, Warm
  "cjVigY5qzO86Huf0OWal", // Eric - Smooth, Trustworthy
  "SAz9YHcvj6GT2YYXdXww", // River - Relaxed, Neutral
  // Professional voices
  "UgBBYS2sOqTuMpoF3BR0", // Mark - Natural Conversations
  "EkK5I93UQWFDigLMpZcX", // James - Husky, Engaging
  "n1PvBOwxb8X6m7tahp2h", // Vincent C. Michaels - Dramatic
  "Bj9UqZbhQsanLzgalpEG", // Austin - Deep, Raspy
  "4YYIPFl9wE5c4L2eu2Gb", // Burt Reynolds - Iconic
  "BL7YSL1bAkmW8U0JnU8o", // Jen - Soothing, Gentle
  "c6SfcYrb2t09NHXiT80T", // Jarnathan - Confident
  "hpp4J3VqNfWAUOO0d1Us", // Bella - Professional, Bright
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
    const voiceMeta: Record<string, { name: string; desc: string; gender: string }> = {};

    for (const voice of data.voices ?? []) {
      if (ALLOWED_IDS.has(voice.voice_id)) {
        if (voice.preview_url) voices[voice.voice_id] = voice.preview_url;
        const firstName = voice.name?.split(" - ")[0]?.split(" (")[0]?.trim() || voice.name || voice.voice_id;
        const subtitle = voice.name?.includes(" - ") ? voice.name.split(" - ").slice(1).join(" - ").trim() : "";
        voiceMeta[voice.voice_id] = {
          name: firstName,
          desc: subtitle || voice.labels?.descriptive || voice.labels?.accent || "",
          gender: voice.labels?.gender || "",
          accent: voice.labels?.accent || "",
          age: voice.labels?.age || "",
          useCase: voice.labels?.use_case || "",
          category: voice.category || "",
        };
      }
    }

    // Fallback for any allowed voices not found in user's library:
    // try fetching them directly by ID
    for (const id of ALLOWED_IDS) {
      if (!voices[id] || !voiceMeta[id]) {
        try {
          const directRes = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
            headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
          });
          if (directRes.ok) {
            const directData = await directRes.json();
            if (directData.preview_url && !voices[id]) {
              voices[id] = directData.preview_url;
            }
            if (!voiceMeta[id]) {
              const fn = directData.name?.split(" - ")[0]?.split(" (")[0]?.trim() || directData.name || id;
              const st = directData.name?.includes(" - ") ? directData.name.split(" - ").slice(1).join(" - ").trim() : "";
              voiceMeta[id] = {
                name: fn,
                desc: st || directData.labels?.descriptive || directData.labels?.accent || "",
                gender: directData.labels?.gender || "",
                accent: directData.labels?.accent || "",
                age: directData.labels?.age || "",
                useCase: directData.labels?.use_case || "",
                category: directData.category || "",
              };
            }
          }
        } catch {
          // skip
        }
      }
    }

    return NextResponse.json({ voices, voiceMeta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
