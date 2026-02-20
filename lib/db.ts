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

function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    return last || "untitled";
  } catch {
    return "untitled";
  }
}

export async function upsertBlogPosts(posts: { url: string; title: string; description?: string; date?: string; category?: string }[]): Promise<number> {
  if (posts.length === 0) return 0;

  // Batch in groups of 25 to stay within Neon query param limits
  const BATCH_SIZE = 25;
  let inserted = 0;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((post) => {
        const audioId = slugFromUrl(post.url);
        return sql`
          INSERT INTO blog_posts_cache (url, title, description, date, category, audio_id)
          VALUES (${post.url}, ${post.title}, ${post.description ?? null}, ${post.date ?? null}, ${post.category ?? null}, ${audioId})
          ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, description = COALESCE(EXCLUDED.description, blog_posts_cache.description), audio_id = COALESCE(blog_posts_cache.audio_id, EXCLUDED.audio_id)
          RETURNING id
        `;
      })
    );
    inserted += results.filter((r) => r.length > 0).length;
  }

  return inserted;
}

export async function getAudioIdByUrl(url: string): Promise<string | null> {
  const rows = await sql`SELECT audio_id FROM blog_posts_cache WHERE url = ${url} LIMIT 1`;
  return rows.length > 0 ? (rows[0] as { audio_id: string }).audio_id : null;
}

export async function getGenerationCountByUrl(url: string): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int as count FROM blog_audio WHERE url = ${url}`;
  return (rows[0] as { count: number }).count;
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
  // Use a single statement to atomically swap the default
  await sql`UPDATE prompt_presets SET is_default = (id = ${id})`;
}

export async function deletePromptPreset(id: number): Promise<void> {
  await sql`DELETE FROM prompt_presets WHERE id = ${id}`;
}

// ── Style History ──

export interface StyleHistoryEntry {
  id: number;
  url: string;
  script: string;
  vibe: string | null;
  word_count: number;
  created_at: string;
}

export async function getStyleHistoryByUrl(url: string): Promise<StyleHistoryEntry[]> {
  const rows = await sql`SELECT * FROM style_history WHERE url = ${url} ORDER BY created_at DESC`;
  return rows as StyleHistoryEntry[];
}

export async function insertStyleHistory(data: {
  url: string;
  script: string;
  vibe?: string;
  word_count?: number;
}): Promise<StyleHistoryEntry> {
  const rows = await sql`
    INSERT INTO style_history (url, script, vibe, word_count)
    VALUES (${data.url}, ${data.script}, ${data.vibe ?? null}, ${data.word_count ?? 0})
    RETURNING *
  `;
  return rows[0] as StyleHistoryEntry;
}

export async function deleteStyleHistory(id: number): Promise<void> {
  await sql`DELETE FROM style_history WHERE id = ${id}`;
}
