import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const md = readFileSync(new URL("./blog.md", import.meta.url), "utf-8");

// Parse the markdown into posts
const posts = [];
const blocks = md.split(/^### /gm).slice(1); // Skip header before first ###

for (const block of blocks) {
  const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) continue;

  // First line: [Title](/blog/slug.md)
  const titleMatch = lines[0].match(/^\[(.+?)\]\((.+?)\)/);
  if (!titleMatch) continue;

  const title = titleMatch[1];
  const mdPath = titleMatch[2]; // e.g. /blog/some-slug.md
  // Convert /blog/slug.md to https://vercel.com/blog/slug
  const slug = mdPath.replace(/^\/blog\//, "").replace(/\.md$/, "");
  const url = `https://vercel.com/blog/${slug}`;

  let date = null;
  let category = null;
  let description = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("Published:")) {
      date = line.replace("Published:", "").trim();
    } else if (line.startsWith("Category:")) {
      category = line.replace("Category:", "").trim();
    } else if (line !== "---") {
      // Everything else is the description
      description = description ? `${description} ${line}` : line;
    }
  }

  posts.push({ url, title, date, category, description });
}

console.log(`Parsed ${posts.length} posts from blog.md`);

// Step 1: Delete all existing posts
console.log("Deleting all existing blog posts...");
await sql`DELETE FROM blog_posts_cache`;
console.log("Deleted all existing posts.");

// Step 2: Insert all posts in batches
const BATCH_SIZE = 25;
let inserted = 0;

for (let i = 0; i < posts.length; i += BATCH_SIZE) {
  const batch = posts.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(
    batch.map((post) => {
      const audioId = post.url
        .replace("https://vercel.com/blog/", "")
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase();
      return sql`
        INSERT INTO blog_posts_cache (url, title, description, date, category, audio_id)
        VALUES (${post.url}, ${post.title}, ${post.description}, ${post.date}, ${post.category}, ${audioId})
        ON CONFLICT (url) DO UPDATE SET
          title = EXCLUDED.title,
          description = COALESCE(EXCLUDED.description, blog_posts_cache.description),
          date = COALESCE(EXCLUDED.date, blog_posts_cache.date),
          category = COALESCE(EXCLUDED.category, blog_posts_cache.category),
          audio_id = COALESCE(blog_posts_cache.audio_id, EXCLUDED.audio_id)
        RETURNING id
      `;
    })
  );
  inserted += results.filter((r) => r.length > 0).length;
  console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${inserted} total)`);
}

console.log(`Done! Inserted ${inserted} posts.`);

// Verify
const count = await sql`SELECT COUNT(*) as cnt FROM blog_posts_cache`;
console.log(`Total posts in database: ${count[0].cnt}`);
