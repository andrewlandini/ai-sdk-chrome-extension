CREATE TABLE IF NOT EXISTS generation_jobs (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, generating, uploading, done, error
  message TEXT,
  result_entry_id INTEGER REFERENCES blog_audio(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_url_status ON generation_jobs(url, status);
