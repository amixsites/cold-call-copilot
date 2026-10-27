-- ====================================================================
-- Cold Call Copilot: Phase 3 Eight-Stage Live Call Workspace Schema
-- Migration: 20261027_eight_stage_call_schema.sql
-- Additive, idempotent schema extension for the 8-stage cold call workflow
-- ====================================================================

-- 1. Extend public.calls table with eight-stage workflow lifecycle fields
alter table public.calls
  add column if not exists active_stage integer not null default 1 check (active_stage between 1 and 8),
  add column if not exists furthest_stage_reached integer not null default 1 check (furthest_stage_reached between 1 and 8),
  add column if not exists ending_stage integer check (ending_stage is null or (ending_stage between 1 and 8)),
  add column if not exists ending_reason text check (
    ending_reason is null or ending_reason in (
      'normal_completion',
      'prospect_ended',
      'caller_ended',
      'gatekeeper_block',
      'wrong_number',
      'busy_callback',
      'line_dropped',
      'not_interested',
      'do_not_call'
    )
  ),
  add column if not exists prospect_words text default '',
  add column if not exists quote_status text not null default 'not_reached' check (
    quote_status in (
      'need_stated',
      'goal_stated',
      'no_need_stated',
      'unclear',
      'not_reached'
    )
  ),
  add column if not exists stage_notes jsonb default '{}'::jsonb;

-- Indexes for calls eight-stage fields
create index if not exists idx_calls_active_stage on public.calls(active_stage);
create index if not exists idx_calls_ending_stage on public.calls(ending_stage);
create index if not exists idx_calls_quote_status on public.calls(quote_status);

-- 2. Create public.call_stage_events table
create table if not exists public.call_stage_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage_number integer not null check (stage_number between 1 and 8),
  event_key text not null,
  event_label text not null,
  event_type text not null default 'action_tap',
  created_at timestamptz not null default now()
);

-- Unique index to prevent duplicate stage event creation on retries
create unique index if not exists idx_call_stage_events_dedup
  on public.call_stage_events(call_id, stage_number, event_key);

-- Query performance indexes
create index if not exists idx_call_stage_events_call_id
  on public.call_stage_events(call_id);
create index if not exists idx_call_stage_events_user_id
  on public.call_stage_events(user_id);
create index if not exists idx_call_stage_events_stage_number
  on public.call_stage_events(stage_number);

-- 3. Row-Level Security for call_stage_events
alter table public.call_stage_events enable row level security;

drop policy if exists "Users can view their own call stage events" on public.call_stage_events;
create policy "Users can view their own call stage events"
  on public.call_stage_events for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own call stage events" on public.call_stage_events;
create policy "Users can insert their own call stage events"
  on public.call_stage_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own call stage events" on public.call_stage_events;
create policy "Users can update their own call stage events"
  on public.call_stage_events for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own call stage events" on public.call_stage_events;
create policy "Users can delete their own call stage events"
  on public.call_stage_events for delete
  to authenticated
  using (user_id = (select auth.uid()));
