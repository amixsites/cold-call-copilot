-- Migration: 20261028_call_reviews_schema.sql
-- Description: Additive schema for Cold Call Copilot post-call AI reviews and lifecycle metadata
-- Phase: Phase 4 — Gemini AI Post-Call Review & Analytics

-- 1. Create public.call_reviews table if it does not already exist
CREATE TABLE IF NOT EXISTS public.call_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  call_summary TEXT NOT NULL DEFAULT '',
  what_went_well JSONB NOT NULL DEFAULT '[]'::jsonb,
  missed_opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  prospect_need_or_goal TEXT NOT NULL DEFAULT '',
  objection_analysis TEXT,
  recommended_next_action TEXT NOT NULL DEFAULT '',
  suggested_follow_up_message TEXT,
  coaching_feedback JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_and_limitations TEXT NOT NULL DEFAULT '',
  model_used TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  source_call_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add unique constraint on call_id to prevent duplicate reviews per call
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_reviews_unique_call_id
  ON public.call_reviews(call_id);

-- 3. Add lookup index for owner user_id
CREATE INDEX IF NOT EXISTS idx_call_reviews_user_id
  ON public.call_reviews(user_id);

-- 4. Enable Row Level Security (RLS) on call_reviews
ALTER TABLE public.call_reviews ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Authenticated users can only read, insert, and update their own call reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_reviews' AND policyname = 'Users can view their own call reviews'
  ) THEN
    CREATE POLICY "Users can view their own call reviews"
      ON public.call_reviews
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_reviews' AND policyname = 'Users can insert their own call reviews'
  ) THEN
    CREATE POLICY "Users can insert their own call reviews"
      ON public.call_reviews
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_reviews' AND policyname = 'Users can update their own call reviews'
  ) THEN
    CREATE POLICY "Users can update their own call reviews"
      ON public.call_reviews
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_reviews' AND policyname = 'Users can delete their own call reviews'
  ) THEN
    CREATE POLICY "Users can delete their own call reviews"
      ON public.call_reviews
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
