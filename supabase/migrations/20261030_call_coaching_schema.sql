-- Migration: 20261030_call_coaching_schema.sql
-- Description: Additive schema for Cold Call Copilot Real-Time LLM Coaching suggestions
-- Phase: Real-Time AI Coaching Integration

-- 1. Create public.call_coaching_suggestions table if it does not already exist
CREATE TABLE IF NOT EXISTS public.call_coaching_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  stage_number INT NOT NULL DEFAULT 1,
  suggested_response TEXT NOT NULL,
  detected_intent TEXT,
  objection TEXT,
  buying_signals JSONB DEFAULT '[]'::jsonb,
  follow_up_question TEXT,
  recommended_action TEXT,
  confidence NUMERIC DEFAULT 0.85,
  source_segment_id TEXT,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Lookup indexes for efficient retrieval by call and user
CREATE INDEX IF NOT EXISTS idx_call_coaching_call_id
  ON public.call_coaching_suggestions(call_id);

CREATE INDEX IF NOT EXISTS idx_call_coaching_user_id
  ON public.call_coaching_suggestions(user_id);

CREATE INDEX IF NOT EXISTS idx_call_coaching_created_at
  ON public.call_coaching_suggestions(call_id, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.call_coaching_suggestions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_coaching_suggestions' AND policyname = 'Users can view their own call coaching suggestions'
  ) THEN
    CREATE POLICY "Users can view their own call coaching suggestions"
      ON public.call_coaching_suggestions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_coaching_suggestions' AND policyname = 'Users can insert their own call coaching suggestions'
  ) THEN
    CREATE POLICY "Users can insert their own call coaching suggestions"
      ON public.call_coaching_suggestions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_coaching_suggestions' AND policyname = 'Users can delete their own call coaching suggestions'
  ) THEN
    CREATE POLICY "Users can delete their own call coaching suggestions"
      ON public.call_coaching_suggestions
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
