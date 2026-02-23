export const dynamic = "force-dynamic";

// Fallback InWorld voices (used when API is unavailable)
const INWORLD_VOICES = [
  { voiceId: "Alex", name: "Alex", gender: "male", desc: "Energetic and expressive mid-range male voice", tags: ["male", "energetic", "expressive"] },
  { voiceId: "Ashley", name: "Ashley", gender: "female", desc: "A warm, natural female voice", tags: ["female", "warm", "natural"] },
  { voiceId: "Dennis", name: "Dennis", gender: "male", desc: "Smooth, calm and friendly middle-aged male", tags: ["male", "calm", "friendly"] },
];

export async function GET() {
  // Try to fetch from InWorld API for the latest list
  const credential = process.env.INWORLD_RUNTIME_BASE64_CREDENTIAL;
  if (credential) {
    try {
      const res = await fetch("https://api.inworld.ai/tts/v1/voices", {
        headers: { Authorization: `Basic ${credential}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.voices && Array.isArray(data.voices)) {
          const voices = data.voices.map((v: any) => ({
            voiceId: v.voiceId || v.voice_id || v.id,
            name: v.displayName || v.name || v.voiceId || "Unknown",
            gender: (v.tags || []).find((t: string) => ["male", "female", "non-binary"].includes(t)) || "",
            desc: v.description || "",
            tags: v.tags || [],
          }));
          return Response.json({ voices });
        }
      }
    } catch {
      // Fall through to hardcoded list
    }
  }

  return Response.json({ voices: INWORLD_VOICES });
}
