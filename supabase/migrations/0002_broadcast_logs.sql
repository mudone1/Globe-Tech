-- Email Broadcast feature: audit log only. No changes to any existing table.
create table public.broadcast_logs (
  id                uuid primary key default gen_random_uuid(),
  subject           text not null,
  recipient_group   text not null,
  recipient_count   integer not null,
  sent_by           uuid references auth.users(id),
  sent_at           timestamptz not null,
  error             text
);

alter table public.broadcast_logs enable row level security;

create policy broadcast_logs_admin_all on public.broadcast_logs for all
  using (public.is_admin()) with check (public.is_admin());
