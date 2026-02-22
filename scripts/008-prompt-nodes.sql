-- prompt_nodes: stores all AI prompts with immutable defaults and user overrides
CREATE TABLE IF NOT EXISTS prompt_nodes (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  default_prompt TEXT NOT NULL,
  user_prompt TEXT,
  model TEXT NOT NULL DEFAULT 'openai/gpt-4o',
  default_model TEXT NOT NULL DEFAULT 'openai/gpt-4o',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- prompt_node_history: audit trail of prompt edits
CREATE TABLE IF NOT EXISTS prompt_node_history (
  id SERIAL PRIMARY KEY,
  node_slug TEXT NOT NULL REFERENCES prompt_nodes(slug),
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_node_history_slug ON prompt_node_history(node_slug);
