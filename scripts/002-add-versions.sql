-- Drop the UNIQUE constraint on url to allow multiple versions per blog post
ALTER TABLE blog_audio DROP CONSTRAINT IF EXISTS blog_audio_url_key;

-- Add ElevenLabs settings columns
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS voice_id TEXT;
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS stability REAL;
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS similarity_boost REAL;
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS label TEXT;
