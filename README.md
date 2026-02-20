# Blog Post Audio Generator

Turn any blog post into an AI-generated audio summary. Paste a URL, and the app scrapes the content, generates a concise summary with the AI SDK, and converts it to speech using ElevenLabs.

## Stack

- **Next.js 15** (App Router)
- **AI SDK 6** for text summarization
- **ElevenLabs** for text-to-speech
- **Neon** (PostgreSQL) for tracking processed blog posts
- **Vercel Blob** for audio file storage

## Getting Started

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   pnpm install
   ```
3. **Set environment variables**
   - `DATABASE_URL` - Neon PostgreSQL connection string
   - `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
   - `ELEVENLABS_API_KEY` - ElevenLabs API key
4. **Run the database migration**
   ```bash
   psql $DATABASE_URL -f scripts/001-create-tables.sql
   ```
5. **Start the dev server**
   ```bash
   pnpm dev
   ```

## How It Works

1. Paste a blog post URL
2. The server scrapes the page content
3. AI SDK generates a ~50-word summary
4. ElevenLabs converts the summary to speech
5. Audio is stored in Vercel Blob, metadata saved to Neon
6. Previously processed URLs are served from cache instantly

## License

MIT
