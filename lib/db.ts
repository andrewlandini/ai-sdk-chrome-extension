import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface BlogAudio {
  id: number;
  url: string;
  title: string | null;
  summary: string | null;
  audio_url: string;
  created_at: string;
}

export async function findByUrl(url: string): Promise<BlogAudio | null> {
  const rows = await sql`
    SELECT * FROM blog_audio WHERE url = ${url} LIMIT 1
  `;
  return (rows[0] as BlogAudio) ?? null;
}

export async function insertBlogAudio(data: {
  url: string;
  title: string;
  summary: string;
  audio_url: string;
}): Promise<BlogAudio> {
  const rows = await sql`
    INSERT INTO blog_audio (url, title, summary, audio_url)
    VALUES (${data.url}, ${data.title}, ${data.summary}, ${data.audio_url})
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
