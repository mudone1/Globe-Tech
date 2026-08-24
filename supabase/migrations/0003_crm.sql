-- ============================================================================
-- crm_access — allowlist of staff (by Supabase Auth user id) who can use
-- the CRM tab, in addition to admins (who always have access). Mirrors
-- public.admins exactly: any signed-in user can read the whole table (so
-- CrmGate can cheaply check "am I on this list"), writable only by admins.
-- ============================================================================
create table public.crm_access (
  user_id     uuid primary key references auth.users(id),
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id)
);
alter table public.crm_access enable row level security;
create policy crm_access_signed_in_read on public.crm_access for select using (auth.uid() is not null);
create policy crm_access_admin_write on public.crm_access for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- applications: additional read grant for CRM-permitted staff. PURELY
-- ADDITIVE — a second, separate policy alongside the existing
-- applications_admin_read (from 0001_init_schema.sql), which is untouched.
-- Postgres OR's multiple SELECT policies together, so this only adds a new
-- way to gain read access; it can never narrow or remove the existing one.
-- Needed because non-admin staff granted CRM access still have no other
-- path to read applications data — the CRM would otherwise be empty for
-- them despite being granted access to it.
-- ============================================================================
create policy applications_crm_read on public.applications for select
  using (exists (select 1 from public.crm_access where user_id = auth.uid()));

-- ============================================================================
-- applicant_outreach — one row per application (created on first edit, not
-- eagerly for all applications), tracking follow-up/outreach state. Keyed
-- 1:1 to applications.application_id — the single source of truth for
-- which applicant this refers to; never a separate applicant record.
-- ============================================================================
create table public.applicant_outreach (
  application_id    text primary key references public.applications(application_id),
  outreach_status    text not null default 'not_called' check (outreach_status in ('called', 'not_called')),
  reachability       text check (reachability in ('reachable', 'not_reachable')),
  call_count         integer not null default 0,
  last_contacted_at  timestamptz,
  notes              text,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id)
);
create index applicant_outreach_updated_at_idx on public.applicant_outreach (updated_at desc);

alter table public.applicant_outreach enable row level security;

create policy applicant_outreach_all on public.applicant_outreach for all
  using (public.is_admin() or exists (select 1 from public.crm_access where user_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.crm_access where user_id = auth.uid()));
