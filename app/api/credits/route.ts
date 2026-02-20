export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });

    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch ElevenLabs subscription" },
        { status: res.status }
      );
    }

    const data = await res.json();

    return Response.json({
      tier: data.tier,
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      nextResetUnix: data.next_character_count_reset_unix,
    });
  } catch (error) {
    console.error("Credits fetch error:", error);
    return Response.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
