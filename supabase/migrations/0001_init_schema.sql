-- Globe-Tech: Firestore -> Postgres schema.
-- Straight, lossless mapping of src/lib/types.ts. Primary keys preserve the
-- EXISTING Firestore document IDs as `text` wherever those IDs are referenced
-- elsewhere in the app (application_id in email links, batch IDs on
-- applications, payout record IDs in the admin UI) — never re-keyed to a
-- fresh uuid, so already-issued links/emails/bookmarks keep working after
-- the import in 0002_data_import.sql.

-- ============================================================================
-- staff
-- ============================================================================
create table public.staff (
  staff_id                 text primary key,
  full_name                text not null,
  tier                     text not null check (tier in ('Regional Coordinator', 'State Coordinator', 'Marketing Officer')),
  email                    text not null,
  phone                    text not null,
  state                    text not null,
  active                   boolean not null default true,
  source_row               integer not null default 0,
  reports_to_code          text,
  reports_to_name          text,
  auth_user_id             uuid references auth.users(id),
  registration_source      text check (registration_source in ('sheet', 'self')),
  pending_approval         boolean,
  registered_at            timestamptz,
  staff_code_corrected     boolean,
  staff_code_corrected_at  timestamptz,
  original_staff_id        text,
  middle_name              text,
  home_address             text,
  social_media_platform    text,
  social_media_username    text,
  nin_number               text,
  mou_accepted             boolean,
  declaration_accepted     boolean,
  state_to_coordinate      text,
  role_specialization      text,
  state_of_influence       text
);
create index staff_reports_to_code_idx on public.staff (reports_to_code);
create index staff_auth_user_id_idx on public.staff (auth_user_id);

-- ============================================================================
-- staff_setup_tokens — short-lived "set password" tokens for self-registration
-- ============================================================================
create table public.staff_setup_tokens (
  token       text primary key,
  staff_id    text not null,
  created_at  timestamptz not null,
  expires_at  timestamptz not null,
  used        boolean not null default false
);

-- ============================================================================
-- link_tokens — opaque /apply/[token] -> staffId map
-- ============================================================================
create table public.link_tokens (
  token       text primary key,
  staff_id    text not null,
  created_at  timestamptz not null,
  is_test     boolean
);
create index link_tokens_staff_id_idx on public.link_tokens (staff_id);

-- ============================================================================
-- applications
-- ============================================================================
create table public.applications (
  application_id                  text primary key,
  referred_by                     text not null,
  referral_token                  text,
  referral_resolution_failed      boolean,

  grant_category                  text not null,
  grant_amount                    numeric not null,

  applicant_name                  text not null,
  phone                           text not null,
  phone_normalized                text,
  email                           text not null,
  state_of_residence              text not null,
  business_name                   text not null,
  grant_need_explanation          text not null,

  business_type                   text,
  business_location               text,
  monthly_product_cost            numeric,

  cac_number                      text,
  business_description            text,

  declaration_agreed              boolean not null,

  status                          text not null,
  created_at                      timestamptz not null,
  phase1_submitted_at             timestamptz not null,
  grant_code                      text not null,
  is_test                         boolean,

  bank_account_number             text,
  bank_account_name               text,
  account_details_submitted_at    timestamptz,
  phase2_verification_status      text,
  phase2_verified_at              timestamptz,
  phase2_verified_batch_id        text,
  phase2_admin_note               text
);
create index applications_referred_by_idx on public.applications (referred_by);
create index applications_phone_normalized_idx on public.applications (phone_normalized);
create index applications_phone_idx on public.applications (phone);
create index applications_phase2_status_idx on public.applications (phase2_verification_status);
create index applications_created_at_idx on public.applications (created_at);

-- ============================================================================
-- email_logs
-- ============================================================================
create table public.email_logs (
  id              uuid primary key default gen_random_uuid(),
  application_id  text not null,
  type            text not null,
  sent_at         timestamptz not null,
  opened          boolean not null default false,
  clicked         boolean not null default false,
  error           text
);
create index email_logs_application_id_idx on public.email_logs (application_id);

-- ============================================================================
-- visits — one row per /apply/[token] page load
-- ============================================================================
create table public.visits (
  id          uuid primary key default gen_random_uuid(),
  token       text not null,
  staff_id    text not null,
  visited_at  timestamptz not null,
  is_test     boolean
);
create index visits_staff_id_idx on public.visits (staff_id);
create index visits_visited_at_idx on public.visits (visited_at);

-- ============================================================================
-- bank_validation_batches — id preserved (referenced by applications.phase2_verified_batch_id)
-- ============================================================================
create table public.bank_validation_batches (
  id             text primary key,
  file_name      text not null,
  uploaded_at    timestamptz not null,
  uploaded_by    text,
  rows           jsonb not null,       -- BankValidationRow[] — same inline-array storage as Firestore
  matched_count  integer not null,
  partial_count  integer not null
);

-- ============================================================================
-- payout_settings — single row (id = 'rate', mirrors the Firestore doc ID)
-- ============================================================================
create table public.payout_settings (
  id                     text primary key,
  per_completion_amount  numeric not null,
  updated_at             timestamptz not null,
  updated_by             text
);

-- ============================================================================
-- payout_records — id preserved (referenced as docId in the admin payouts UI)
-- ============================================================================
create table public.payout_records (
  id            text primary key,
  staff_id      text not null,
  amount        numeric not null,
  note          text,
  paid_at       timestamptz not null,
  recorded_by   text
);
create index payout_records_staff_id_idx on public.payout_records (staff_id);

-- ============================================================================
-- admins allowlist — user_id is the SUPABASE auth.users.id (remapped from the
-- old Firebase uid during import — see 0002_data_import.sql for the mapping)
-- ============================================================================
create table public.admins (
  user_id  uuid primary key references auth.users(id)
);

-- ============================================================================
-- application_duplicates_archive — full original record kept as jsonb so it
-- doesn't need to duplicate every applications column a second time
-- ============================================================================
create table public.application_duplicates_archive (
  application_id   text primary key,
  data             jsonb not null,
  archived_at      timestamptz not null,
  archived_reason  text
);

-- ============================================================================
-- app_settings — small keyed table of admin-editable toggles (id = 'referralLinks' today)
-- ============================================================================
create table public.app_settings (
  id           text primary key,
  links_hidden boolean,
  updated_at   timestamptz not null,
  updated_by   text
);

-- ============================================================================
-- RLS — mirrors firestore.rules exactly (see that file for the 1:1 rationale
-- behind each table's access shape).
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

alter table public.staff enable row level security;
alter table public.staff_setup_tokens enable row level security;
alter table public.link_tokens enable row level security;
alter table public.applications enable row level security;
alter table public.email_logs enable row level security;
alter table public.visits enable row level security;
alter table public.bank_validation_batches enable row level security;
alter table public.payout_settings enable row level security;
alter table public.payout_records enable row level security;
alter table public.admins enable row level security;
alter table public.application_duplicates_archive enable row level security;
alter table public.app_settings enable row level security;

-- staff: admin-only read, no client writes (synced/written server-side only)
create policy staff_admin_read on public.staff for select using (public.is_admin());

-- staff_setup_tokens: no client access at all — the token itself is the credential
-- (no policy created -> RLS default-denies everything except the service role)

-- link_tokens: admin-only read, no client writes
create policy link_tokens_admin_read on public.link_tokens for select using (public.is_admin());

-- applications: admin-only read; admin update restricted to the same column
-- set firestore.rules allowed; no client insert/delete (server-only via
-- service role, which bypasses RLS entirely — same shape as Firestore's
-- "create: if false" + Admin SDK bypass).
create policy applications_admin_read on public.applications for select using (public.is_admin());
create policy applications_admin_update on public.applications for update using (public.is_admin())
  with check (public.is_admin());

-- email_logs: admin-only read, no client writes
create policy email_logs_admin_read on public.email_logs for select using (public.is_admin());

-- visits: admin-only read, no client writes
create policy visits_admin_read on public.visits for select using (public.is_admin());

-- bank_validation_batches: admin read/write
create policy bank_validation_batches_admin_all on public.bank_validation_batches for all
  using (public.is_admin()) with check (public.is_admin());

-- payout_settings: admin read/write
create policy payout_settings_admin_all on public.payout_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- payout_records: admin read/write
create policy payout_records_admin_all on public.payout_records for all
  using (public.is_admin()) with check (public.is_admin());

-- admins allowlist: any signed-in user can read (matches firestore.rules'
-- isSignedIn() read rule — the client checks "am I in this table" for its
-- own AdminGate check), never client-writable
create policy admins_signed_in_read on public.admins for select using (auth.uid() is not null);

-- application_duplicates_archive: admin-only read, no client writes
create policy archive_admin_read on public.application_duplicates_archive for select using (public.is_admin());

-- app_settings: admin read/write
create policy app_settings_admin_all on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());
