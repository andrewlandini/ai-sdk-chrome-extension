import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const correctUrl = "https://vercel.com/blog/How-Stably-ships-AI-testing-agents-in-hours-not-weeks";

const r1 = await sql`UPDATE blog_posts_cache SET url = ${correctUrl} WHERE url ILIKE '%stably%' RETURNING url`;
console.log("blog_posts_cache updated:", r1.length, "rows");

const r2 = await sql`UPDATE blog_audio SET url = ${correctUrl} WHERE url ILIKE '%stably%' RETURNING url`;
console.log("blog_audio updated:", r2.length, "rows");
