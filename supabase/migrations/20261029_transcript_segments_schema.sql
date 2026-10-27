-- Migration: 20261029_transcript_segments_schema.sql
-- Description: Additive schema for Cold Call Copilot live speech-to-text transcript segments
-- Phase: Gemini AI + Real-Time Speech-to-Text Integration

-- 1. Create public.call_transcript_segments table if it does not already exist
CREATE TABLE IF NOT EXISTS public.call_transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  segment_id TEXT NOT NULL,
  text TEXT NOT NULL,
  speaker TEXT NOT NULL DEFAULT 'unknown',
  is_final BOOLEAN NOT NULL DEFAULT true,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Unique constraint on (call_id, segment_id) to prevent duplicate records during recognition restarts
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_transcript_segments_unique_call_segment
  ON public.call_transcript_segments(call_id, segment_id);

-- 3. Lookup indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_call_id
  ON public.call_transcript_segments(call_id);

CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_user_id
  ON public.call_transcript_segments(user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.call_transcript_segments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_transcript_segments' AND policyname = 'Users can view their own call transcript segments'
  ) THEN
    CREATE POLICY "Users can view their own call transcript segments"
      ON public.call_transcript_segments
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_transcript_segments' AND policyname = 'Users can insert their own call transcript segments'
  ) THEN
    CREATE POLICY "Users can insert their own call transcript segments"
      ON public.call_transcript_segments
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_transcript_segments' AND policyname = 'Users can delete their own call transcript segments'
  ) THEN
    CREATE POLICY "Users can delete their own call transcript segments"
      ON public.call_transcript_segments
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
