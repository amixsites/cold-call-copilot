-- ====================================================================
-- Cold Call Copilot: Phase 3 Database Schema & Security Migration
-- Target: Supabase PostgreSQL (Project ref: rduxyhkwgykejczxircd)
-- Safe, additive migration with strict Row-Level Security (RLS)
-- ====================================================================

-- 1. Helper function for automated updated_at timestamps
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2. Profiles Table (1-to-1 extension of Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  title text default 'Sales Representative',
  company text default 'Cold Call Copilot Manufacturing Sales',
  territory text default 'Industrial Equipment & Parts',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Automatic Profile Creation Trigger on Sign-Up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.email,
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger for profiles updated_at
drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 3. Prospects Table
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text,
  job_title text,
  industry text not null default 'Manufacturing',
  email text,
  phone text,
  website text,
  location text,
  employee_count text,
  manufacturing_type text,
  status text not null default 'New' check (
    status in ('New', 'Attempted', 'In Discussion', 'Qualified', 'Unqualified', 'Archived')
  ),
  notes text,
  last_contact_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger for prospects updated_at
drop trigger if exists update_prospects_updated_at on public.prospects;
create trigger update_prospects_updated_at
  before update on public.prospects
  for each row execute function public.handle_updated_at();

-- 4. Calls Table (5-Dimensional Discovery Notes)
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  company_name text not null,
  contact_name text,
  call_date timestamptz not null default now(),
  duration_seconds integer not null default 0,
  call_status text not null default 'Not Started' check (
    call_status in ('Not Started', 'In Progress', 'Completed')
  ),
  call_objective text not null default 'General manufacturing discovery',
  agenda jsonb default '[]'::jsonb,
  pre_call_notes text,
  general_notes text default '',
  problems_notes text,
  evidence_notes text,
  unknowns_notes text,
  objections_notes text,
  outcome text check (
    outcome is null or outcome in (
      'Connected - Interested',
      'Connected - Follow-up Required',
      'Connected - Follow-up Needed',
      'Connected - Not Interested',
      'No Answer / Voicemail',
      'Left Voicemail',
      'Gatekeeper Blocked',
      'Wrong Contact / Number',
      'Callback Requested'
    )
  ),
  next_action text,
  follow_up_date date,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger for calls updated_at
drop trigger if exists update_calls_updated_at on public.calls;
create trigger update_calls_updated_at
  before update on public.calls
  for each row execute function public.handle_updated_at();

-- 5. Follow-ups Table
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  call_id uuid references public.calls(id) on delete set null,
  company_name text not null,
  contact_name text,
  task text not null,
  description text,
  priority text not null default 'Medium' check (
    priority in ('High', 'Medium', 'Low')
  ),
  status text not null default 'Pending' check (
    status in ('Pending', 'Completed', 'Cancelled')
  ),
  due_date date not null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger for follow_ups updated_at
drop trigger if exists update_follow_ups_updated_at on public.follow_ups;
create trigger update_follow_ups_updated_at
  before update on public.follow_ups
  for each row execute function public.handle_updated_at();

-- ====================================================================
-- Indexes for High Performance and RLS Optimization
-- ====================================================================
create index if not exists idx_prospects_user_id on public.prospects(user_id);
create index if not exists idx_prospects_status on public.prospects(status);

create index if not exists idx_calls_user_id on public.calls(user_id);
create index if not exists idx_calls_prospect_id on public.calls(prospect_id);
create index if not exists idx_calls_call_status on public.calls(call_status);

create index if not exists idx_follow_ups_user_id on public.follow_ups(user_id);
create index if not exists idx_follow_ups_prospect_id on public.follow_ups(prospect_id);
create index if not exists idx_follow_ups_call_id on public.follow_ups(call_id);
create index if not exists idx_follow_ups_status on public.follow_ups(status);
create index if not exists idx_follow_ups_due_date on public.follow_ups(due_date);

-- ====================================================================
-- Row Level Security (RLS) Configuration
-- ====================================================================

-- 1. Profiles RLS
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- 2. Prospects RLS
alter table public.prospects enable row level security;

drop policy if exists "Users can view their own prospects" on public.prospects;
create policy "Users can view their own prospects"
  on public.prospects for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own prospects" on public.prospects;
create policy "Users can insert their own prospects"
  on public.prospects for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own prospects" on public.prospects;
create policy "Users can update their own prospects"
  on public.prospects for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own prospects" on public.prospects;
create policy "Users can delete their own prospects"
  on public.prospects for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 3. Calls RLS
alter table public.calls enable row level security;

drop policy if exists "Users can view their own calls" on public.calls;
create policy "Users can view their own calls"
  on public.calls for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own calls" on public.calls;
create policy "Users can insert their own calls"
  on public.calls for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own calls" on public.calls;
create policy "Users can update their own calls"
  on public.calls for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own calls" on public.calls;
create policy "Users can delete their own calls"
  on public.calls for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- 4. Follow-ups RLS
alter table public.follow_ups enable row level security;

drop policy if exists "Users can view their own follow-ups" on public.follow_ups;
create policy "Users can view their own follow-ups"
  on public.follow_ups for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own follow-ups" on public.follow_ups;
create policy "Users can insert their own follow-ups"
  on public.follow_ups for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own follow-ups" on public.follow_ups;
create policy "Users can update their own follow-ups"
  on public.follow_ups for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own follow-ups" on public.follow_ups;
create policy "Users can delete their own follow-ups"
  on public.follow_ups for delete
  to authenticated
  using (user_id = (select auth.uid()));
