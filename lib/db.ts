import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

// ── Blog Audio ──

export interface BlogAudio {
  id: number;
  url: string;
  title: string | null;
  summary: string | null;
  audio_url: string;
  voice_id: string | null;
  model_id: string | null;
  stability: number | null;
  similarity_boost: number | null;
  label: string | null;
  created_at: string;
}

export async function findVersionsByUrl(url: string): Promise<BlogAudio[]> {
  const rows = await sql`SELECT * FROM blog_audio WHERE url = ${url} ORDER BY created_at DESC`;
  return rows as BlogAudio[];
}

export async function insertBlogAudio(data: {
  url: string;
  title: string;
  summary: string;
  audio_url: string;
  voice_id?: string;
  model_id?: string;
  stability?: number;
  similarity_boost?: number;
  label?: string;
}): Promise<BlogAudio> {
  const rows = await sql`
    INSERT INTO blog_audio (url, title, summary, audio_url, voice_id, model_id, stability, similarity_boost, label)
    VALUES (${data.url}, ${data.title}, ${data.summary}, ${data.audio_url},
      ${data.voice_id ?? null}, ${data.model_id ?? null},
      ${data.stability ?? null}, ${data.similarity_boost ?? null}, ${data.label ?? null})
    RETURNING *
  `;
  return rows[0] as BlogAudio;
}

export async function getAllBlogAudio(): Promise<BlogAudio[]> {
  const rows = await sql`SELECT * FROM blog_audio ORDER BY created_at DESC`;
  return rows as BlogAudio[];
}

export async function deleteBlogAudio(id: number): Promise<void> {
  await sql`DELETE FROM blog_audio WHERE id = ${id}`;
}

// ── Voice Presets ──

export interface VoicePreset {
  id: number;
  name: string;
  voice_id: string;
  stability: number;
  created_at: string;
}

export async function getAllPresets(): Promise<VoicePreset[]> {
  const rows = await sql`SELECT id, name, voice_id, stability, created_at FROM voice_presets ORDER BY created_at DESC`;
  return rows as VoicePreset[];
}

export async function insertPreset(data: {
  name: string;
  voice_id: string;
  stability: number;
}): Promise<VoicePreset> {
  const rows = await sql`
    INSERT INTO voice_presets (name, voice_id, model_id, stability, similarity_boost)
    VALUES (${data.name}, ${data.voice_id}, ${"eleven_v3"}, ${data.stability}, ${0})
    RETURNING id, name, voice_id, stability, created_at
  `;
  return rows[0] as VoicePreset;
}

export async function deletePreset(id: number): Promise<void> {
  await sql`DELETE FROM voice_presets WHERE id = ${id}`;
}

// ── Blog Posts Cache ──

export interface CachedBlogPost {
  id: number;
  url: string;
  title: string;
  description: string | null;
  date: string | null;
  category: string | null;
  script: string | null;
  created_at: string;
}

export async function getCachedBlogPosts(): Promise<CachedBlogPost[]> {
  const rows = await sql`SELECT * FROM blog_posts_cache ORDER BY created_at DESC`;
  return rows as CachedBlogPost[];
}

export async function upsertBlogPosts(posts: { url: string; title: string; description?: string; date?: string; category?: string }[]): Promise<number> {
  let inserted = 0;
  for (const post of posts) {
    const result = await sql`
      INSERT INTO blog_posts_cache (url, title, description, date, category)
      VALUES (${post.url}, ${post.title}, ${post.description ?? null}, ${post.date ?? null}, ${post.category ?? null})
      ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, description = COALESCE(EXCLUDED.description, blog_posts_cache.description)
      RETURNING id
    `;
    if (result.length > 0) inserted++;
  }
  return inserted;
}

export async function getCachedPostCount(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int as count FROM blog_posts_cache`;
  return (rows[0] as { count: number }).count;
}

// ── Prompt Presets ──

export interface PromptPreset {
  id: number;
  name: string;
  system_prompt: string;
  test_prompt: string;
  blog_fetch_prompt: string | null;
  model: string;
  blog_fetch_model: string;
  style_agent_model: string;
  is_default: boolean;
  created_at: string;
}

export async function getAllPromptPresets(): Promise<PromptPreset[]> {
  const rows = await sql`SELECT * FROM prompt_presets ORDER BY is_default DESC, created_at DESC`;
  return rows as PromptPreset[];
}

export async function getActivePromptPreset(): Promise<PromptPreset | null> {
  const rows = await sql`SELECT * FROM prompt_presets WHERE is_default = true LIMIT 1`;
  return rows.length > 0 ? (rows[0] as PromptPreset) : null;
}

export async function insertPromptPreset(data: {
  name: string;
  system_prompt: string;
  test_prompt: string;
  blog_fetch_prompt?: string | null;
  model?: string;
  blog_fetch_model?: string;
  style_agent_model?: string;
  is_default?: boolean;
}): Promise<PromptPreset> {
  const rows = await sql`
    INSERT INTO prompt_presets (name, system_prompt, test_prompt, blog_fetch_prompt, model, blog_fetch_model, style_agent_model, is_default)
    VALUES (${data.name}, ${data.system_prompt}, ${data.test_prompt}, ${data.blog_fetch_prompt ?? null}, ${data.model ?? "openai/gpt-4o"}, ${data.blog_fetch_model ?? "openai/gpt-4o-mini"}, ${data.style_agent_model ?? "openai/gpt-4o"}, ${data.is_default ?? false})
    RETURNING *
  `;
  return rows[0] as PromptPreset;
}

export async function updatePromptPreset(id: number, data: {
  name: string;
  system_prompt: string;
  test_prompt: string;
  blog_fetch_prompt?: string | null;
  model: string;
  blog_fetch_model?: string;
  style_agent_model?: string;
}): Promise<PromptPreset> {
  const rows = await sql`
    UPDATE prompt_presets SET 
      name = ${data.name}, 
      system_prompt = ${data.system_prompt}, 
      test_prompt = ${data.test_prompt}, 
      blog_fetch_prompt = ${data.blog_fetch_prompt ?? null}, 
      model = ${data.model},
      blog_fetch_model = ${data.blog_fetch_model ?? "openai/gpt-4o-mini"},
      style_agent_model = ${data.style_agent_model ?? "openai/gpt-4o"}
    WHERE id = ${id} RETURNING *
  `;
  return rows[0] as PromptPreset;
}

export async function setDefaultPromptPreset(id: number): Promise<void> {
  await sql`UPDATE prompt_presets SET is_default = false WHERE is_default = true`;
  await sql`UPDATE prompt_presets SET is_default = true WHERE id = ${id}`;
}

export async function deletePromptPreset(id: number): Promise<void> {
  await sql`DELETE FROM prompt_presets WHERE id = ${id}`;
}
