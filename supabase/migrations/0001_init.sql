-- Kargo Hiring Dashboard — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`) before seeding.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Rubric: the standard every candidate is scored against.
-- Seeded from data/rubric.json via `npm run seed:rubric` — do not hand-edit
-- rows here; edit the JSON and re-run the seed script so the app, the DB,
-- and rubric.txt never drift apart.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('PM', 'SPM')),
  sort_order int not null,
  name text not null,
  weight numeric(5,2) not null,
  description text not null,
  anchor_5 text not null,
  anchor_3 text not null,
  anchor_1 text not null,
  created_at timestamptz not null default now(),
  unique (role, name)
);

-- Reference copy of the two job descriptions. Used only for the "what to
-- probe" line in interview briefs — never as scoring input (the rubric is
-- deliberately independent of the JDs).
create table if not exists role_context (
  role text primary key check (role in ('PM', 'SPM')),
  jd_text text not null,
  updated_at timestamptz not null default now()
);

-- One row per uploaded CV.
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  role_applied text not null check (role_applied in ('PM', 'SPM')),

  -- Personal details — stored here only, never sent to any AI step.
  full_name text not null,
  email text not null,
  phone text,

  cv_filename text not null,
  cv_text text not null,          -- sanitized (PII-stripped) text sent to Gemini
  cv_storage_path text,           -- optional: original file in Supabase Storage

  status text not null default 'uploaded'
    check (status in (
      'uploaded', 'scoring', 'scored', 'briefing', 'drafting',
      'ready_for_review', 'sent'
    )),
  shortlisted boolean not null default false, -- above the line for role_applied
  error text,                                  -- last pipeline error, if any

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_candidates_role on candidates (role_applied);

-- A candidate is scored against BOTH rubrics regardless of role_applied.
create table if not exists candidate_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  rubric_role text not null check (rubric_role in ('PM', 'SPM')),
  criterion_name text not null,
  weight numeric(5,2) not null,
  score int not null check (score between 1 and 5),
  reason text not null,
  weighted_points numeric(6,3) not null, -- (score/5.0) * weight
  created_at timestamptz not null default now(),
  unique (candidate_id, rubric_role, criterion_name)
);

create index if not exists idx_scores_candidate on candidate_scores (candidate_id);

-- Three-sentence interview brief — generated only for shortlisted candidates.
create table if not exists briefs (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  brief_text text not null,
  created_at timestamptz not null default now()
);

-- Drafted, editable, sendable email per candidate.
create table if not exists email_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  email_type text not null check (email_type in ('invite', 'reject')),
  subject text not null,
  body text not null,
  edited boolean not null default false,
  sent_at timestamptz,
  resend_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id)
);

-- Small key/value config table (e.g. shortlist size per role).
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
  ('shortlist_size_pm', '5'),
  ('shortlist_size_spm', '5')
on conflict (key) do nothing;

-- Convenience view: total weighted score per candidate per rubric role.
-- security_invoker=on so it respects RLS instead of the view creator's.
create or replace view candidate_totals
with (security_invoker = on)
as
select
  candidate_id,
  rubric_role,
  round(sum(weighted_points), 2) as total_score
from candidate_scores
group by candidate_id, rubric_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Lock every table down to service_role only. This app has no end-user
-- auth model (single founder, gated by an app-level access code — see
-- APP_ACCESS_CODE), so the server always talks to Supabase with the
-- service_role key, which bypasses RLS entirely. Enabling RLS with zero
-- policies means the anon/publishable key — which could in principle leak
-- or be inspected — gets nothing back from PostgREST, including candidate
-- PII (name, email, phone).
-- ─────────────────────────────────────────────────────────────────────────
alter table rubric_criteria enable row level security;
alter table role_context enable row level security;
alter table candidates enable row level security;
alter table candidate_scores enable row level security;
alter table briefs enable row level security;
alter table email_drafts enable row level security;
alter table settings enable row level security;
