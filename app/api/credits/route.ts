import { getCachedCredits, upsertCachedCredits } from "@/lib/db";

export const dynamic = "force-dynamic";

async function fetchFromElevenLabs() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tier: data.tier as string,
      characterCount: data.character_count as number,
      characterLimit: data.character_limit as number,
      nextResetUnix: data.next_character_count_reset_unix as number,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "true";

  // If refresh requested (after generation), fetch live from ElevenLabs and save to DB
  if (refresh) {
    const live = await fetchFromElevenLabs();
    if (live) {
      await upsertCachedCredits(live);
      return Response.json(live);
    }
  }

  // Read from Neon cache
  const cached = await getCachedCredits();
  if (cached && cached.characterLimit > 0) {
    return Response.json({
      tier: cached.tier,
      characterCount: cached.characterCount,
      characterLimit: cached.characterLimit,
      nextResetUnix: cached.nextResetUnix,
    });
  }

  // Cache is empty/placeholder -- fetch from ElevenLabs and seed the cache
  const live = await fetchFromElevenLabs();
  if (live) {
    await upsertCachedCredits(live).catch(() => {});
    return Response.json(live);
  }

  return Response.json(
    { error: "Credits unavailable" },
    { status: 503 }
  );
}
