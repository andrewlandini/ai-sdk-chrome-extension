import { NextResponse } from "next/server";

export const maxDuration = 30;

// Curated v3 voice IDs we actually show in the UI
const ALLOWED_IDS = new Set([
  "PIGsltMj3gFMR34aFDI3",
  "UgBBYS2sOqTuMpoF3BR0",
  "X03mvPuTfprif8QBAVeJ",
  "tnSpp4vdxKPjI9w0GnoV",
  "kPzsL2i3teMYv0FxEYQ6",
  "15CVCzDByBinCIoCblXo",
  "q0IMILNRPxOgtBTS4taI",
  "6u6JbqKdaQy89ENzLSju",
  "fDeOZu1sNd7qahm2fV4k",
  "yr43K8H5LoTp6S1QFSGg",
  "eXpIbVcVbLo8ZJQDlDnl",
  "IoYPiP0wwoQzmraBbiju",
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
        voiceMeta[voice.voice_id] = {
          name: voice.name?.split(" - ")[0]?.split(" (")[0]?.trim() || voice.name || voice.voice_id,
          desc: voice.labels?.description || voice.labels?.accent || voice.description?.slice(0, 40) || "",
          gender: voice.labels?.gender || "",
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
              voiceMeta[id] = {
                name: directData.name?.split(" - ")[0]?.split(" (")[0]?.trim() || directData.name || id,
                desc: directData.labels?.description || directData.labels?.accent || directData.description?.slice(0, 40) || "",
                gender: directData.labels?.gender || "",
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
