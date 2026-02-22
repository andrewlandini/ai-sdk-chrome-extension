-- Add chunk_map JSONB column to blog_audio
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS chunk_map JSONB;

-- Per-chunk re-generation history
CREATE TABLE IF NOT EXISTS chunk_versions (
  id SERIAL PRIMARY KEY,
  blog_audio_id INT NOT NULL REFERENCES blog_audio(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  audio_blob_url TEXT NOT NULL,
  duration_ms REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
