import { NextResponse } from "next/server";

export const maxDuration = 30;

// Curated voice IDs
const ALLOWED_IDS = new Set([
  "PIGsltMj3gFMR34aFDI3", // Jonathan Livingston - Authentic, Calming & Pleasing
  "UgBBYS2sOqTuMpoF3BR0", // Mark - Natural Conversations
  "X03mvPuTfprif8QBAVeJ", // Christina - Natural and Conversational
  "tnSpp4vdxKPjI9w0GnoV", // Hope - Upbeat and Clear
  "kPzsL2i3teMYv0FxEYQ6", // Brittney - Fun, Youthful & Informative
  "15CVCzDByBinCIoCblXo", // Lucan Rook - Energetic Male
  "q0IMILNRPxOgtBTS4taI", // Drew - Casual, Curious & Fun
  "6u6JbqKdaQy89ENzLSju", // Brielle - Podcast, Extremely Natural
  "fDeOZu1sNd7qahm2fV4k", // Luna - Bubbly, Bright, Cheery
  "yr43K8H5LoTp6S1QFSGg", // Matt
  "eXpIbVcVbLo8ZJQDlDnl", // Siren - Natural, Realistic, Conversational
  "IoYPiP0wwoQzmraBbiju", // Patrick Gabriel Gonzales - Youthful
]);

// Fallback metadata for shared/community voices that can't be fetched by GET /voices/:id
const FALLBACK_META: Record<string, { name: string; desc: string; gender: string }> = {
  "PIGsltMj3gFMR34aFDI3": { name: "Jonathan", desc: "Authentic, Calming & Pleasing", gender: "male" },
  "X03mvPuTfprif8QBAVeJ": { name: "Christina", desc: "Natural and Conversational", gender: "female" },
  "tnSpp4vdxKPjI9w0GnoV": { name: "Hope", desc: "Upbeat and Clear", gender: "female" },
  "kPzsL2i3teMYv0FxEYQ6": { name: "Brittney", desc: "Fun, Youthful & Informative", gender: "female" },
  "15CVCzDByBinCIoCblXo": { name: "Lucan Rook", desc: "Energetic Male", gender: "male" },
  "q0IMILNRPxOgtBTS4taI": { name: "Drew", desc: "Casual, Curious & Fun", gender: "male" },
  "6u6JbqKdaQy89ENzLSju": { name: "Brielle", desc: "Podcast, Extremely Natural", gender: "female" },
  "fDeOZu1sNd7qahm2fV4k": { name: "Luna", desc: "Bubbly, Bright & Cheery", gender: "female" },
  "yr43K8H5LoTp6S1QFSGg": { name: "Matt", desc: "", gender: "male" },
  "eXpIbVcVbLo8ZJQDlDnl": { name: "Siren", desc: "Natural, Realistic, Conversational", gender: "female" },
  "IoYPiP0wwoQzmraBbiju": { name: "Patrick", desc: "Youthful & YouTube Voice", gender: "male" },
};

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

    // For shared/community voices not in the user's library,
    // use hardcoded fallback metadata and try the search endpoint for previews
    const missingIds = [...ALLOWED_IDS].filter(id => !voiceMeta[id]);
    if (missingIds.length > 0) {
      // Try to find preview URLs via the shared-voices search endpoint
      await Promise.all(missingIds.map(async (id) => {
        // Apply fallback metadata immediately
        if (FALLBACK_META[id]) {
          voiceMeta[id] = FALLBACK_META[id];
        }
        // Search for preview URL
        try {
          const searchRes = await fetch(
            `https://api.elevenlabs.io/v1/shared-voices?search=${id}&page_size=5`,
            { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const v of searchData.voices ?? []) {
              if (v.voice_id === id && v.preview_url) {
                voices[id] = v.preview_url;
                break;
              }
            }
          }
        } catch {
          // skip -- voice still works for TTS even without preview
        }
      }));
    }

    return NextResponse.json({ voices, voiceMeta });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
