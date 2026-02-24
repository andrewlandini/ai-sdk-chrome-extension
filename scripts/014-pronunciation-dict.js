import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
await sql`CREATE TABLE IF NOT EXISTS pronunciation_dict (
  id SERIAL PRIMARY KEY,
  original TEXT NOT NULL UNIQUE,
  pronunciation TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
)`;
console.log("Created pronunciation_dict table");
