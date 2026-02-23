export const dynamic = "force-dynamic";

// Hardcoded InWorld voices (their API has these 3 built-in voices)
const INWORLD_VOICES = [
  { voiceId: "Alex", name: "Alex", gender: "male", desc: "Natural male voice" },
  { voiceId: "Ashley", name: "Ashley", gender: "female", desc: "Natural female voice" },
  { voiceId: "Dennis", name: "Dennis", gender: "male", desc: "Natural male voice" },
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
            name: v.name || v.voiceId || "Unknown",
            gender: v.gender || "",
            desc: v.description || "",
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
