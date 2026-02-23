-- Add tts_provider column to blog_audio to track which TTS engine was used
ALTER TABLE blog_audio ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'elevenlabs';

-- Add tts_provider column to voice_presets so presets remember the provider
ALTER TABLE voice_presets ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'elevenlabs';
