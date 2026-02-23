CREATE TABLE IF NOT EXISTS pronunciation_dict (
  id SERIAL PRIMARY KEY,
  original TEXT NOT NULL UNIQUE,
  pronunciation TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
