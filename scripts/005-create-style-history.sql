CREATE TABLE IF NOT EXISTS style_history (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  script TEXT NOT NULL,
  vibe TEXT,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_style_history_url ON style_history(url);
