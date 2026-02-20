-- Blog posts cache table
CREATE TABLE IF NOT EXISTS blog_posts_cache (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt presets table
CREATE TABLE IF NOT EXISTS prompt_presets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  test_prompt TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
