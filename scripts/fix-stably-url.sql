-- Fix the URL for "How Stably ships AI testing agents in hours, not weeks"
-- The correct URL uses capitalized "How" in the path

UPDATE blog_posts_cache
SET url = 'https://vercel.com/blog/How-Stably-ships-AI-testing-agents-in-hours-not-weeks'
WHERE url ILIKE '%stably%';

UPDATE blog_audio
SET url = 'https://vercel.com/blog/How-Stably-ships-AI-testing-agents-in-hours-not-weeks'
WHERE url ILIKE '%stably%';
