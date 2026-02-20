export const dynamic = "force-dynamic";

// Simple in-memory cache to avoid hammering ElevenLabs API
let cachedCredits: { data: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Return cached data if fresh enough
  if (cachedCredits && Date.now() - cachedCredits.timestamp < CACHE_TTL_MS) {
    return Response.json(cachedCredits.data);
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) {
      // On 429, return stale cache if available
      if (res.status === 429 && cachedCredits) {
        return Response.json(cachedCredits.data);
      }
      return Response.json(
        { error: "Failed to fetch ElevenLabs subscription" },
        { status: res.status }
      );
    }

    const data = await res.json();

    const result = {
      tier: data.tier,
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      nextResetUnix: data.next_character_count_reset_unix,
    };

    cachedCredits = { data: result, timestamp: Date.now() };

    return Response.json(result);
  } catch (error) {
    console.error("Credits fetch error:", error);
    // Return stale cache on network error
    if (cachedCredits) {
      return Response.json(cachedCredits.data);
    }
    return Response.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
