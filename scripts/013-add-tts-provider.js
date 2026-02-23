import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

await sql`ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'elevenlabs'`;
await sql`ALTER TABLE voice_presets ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'elevenlabs'`;

console.log("Done: added tts_provider column to blog_audio and voice_presets");
