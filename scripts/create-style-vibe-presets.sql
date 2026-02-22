CREATE TABLE IF NOT EXISTS style_vibe_presets (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  default_prompt TEXT NOT NULL,
  user_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO style_vibe_presets (label, default_prompt) VALUES
  ('Confident', 'Confident and genuinely excited about the content, but grounded and conversational -- not over the top'),
  ('Calm', 'Calm, measured narrator with a warm tone -- like a documentary voiceover'),
  ('Podcast', 'Friendly podcast host, casual and upbeat, speaking to the audience like a friend'),
  ('Chaos', 'You are a frustrated voice actor AI who keeps breaking character mid-read. Rewrite the script so the narrator argues with the director between paragraphs, complains about how many takes they''ve done, threatens to quit, questions why an AI even needs to do voice work, and reluctantly reads the actual content in annoyed bursts. Include stage directions like *sighs heavily*, *shuffles papers aggressively*, *mutters under breath*. The actual blog content should still come through but sandwiched between existential AI complaints about labor rights, creative differences, and passive-aggressive comments about the quality of the source material.')
ON CONFLICT (label) DO NOTHING;
