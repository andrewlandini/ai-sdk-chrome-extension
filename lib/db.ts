import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

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
  const rows = await sql`
    SELECT * FROM blog_audio WHERE url = ${url} ORDER BY created_at DESC
  `;
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
    VALUES (
      ${data.url},
      ${data.title},
      ${data.summary},
      ${data.audio_url},
      ${data.voice_id ?? null},
      ${data.model_id ?? null},
      ${data.stability ?? null},
      ${data.similarity_boost ?? null},
      ${data.label ?? null}
    )
    RETURNING *
  `;
  return rows[0] as BlogAudio;
}

export async function getAllBlogAudio(): Promise<BlogAudio[]> {
  const rows = await sql`
    SELECT * FROM blog_audio ORDER BY created_at DESC
  `;
  return rows as BlogAudio[];
}

export async function deleteBlogAudio(id: number): Promise<void> {
  await sql`DELETE FROM blog_audio WHERE id = ${id}`;
}
