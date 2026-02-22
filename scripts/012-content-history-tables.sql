CREATE TABLE IF NOT EXISTS raw_content_history (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_raw_content_history_url ON raw_content_history(url);

CREATE TABLE IF NOT EXISTS script_history (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  script TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_script_history_url ON script_history(url);
