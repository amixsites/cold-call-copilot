-- Migration: 20261031_manual_speaker_correction.sql
-- Description: Additive schema for manual speaker correction and source tracking
-- Feature: Manual Speaker Correction + Instant AI Coaching Refresh

-- 1. Add speaker_source column to public.call_transcript_segments if not exists
ALTER TABLE public.call_transcript_segments 
  ADD COLUMN IF NOT EXISTS speaker_source TEXT NOT NULL DEFAULT 'automatic';

-- 2. Add index on speaker_source for efficient filtering
CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_speaker_source
  ON public.call_transcript_segments(speaker_source);
