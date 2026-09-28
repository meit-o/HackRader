-- Run this once on an existing HackRadar Supabase project before deploying the
-- matching application code. Existing events remain editable until their dates
-- are set by the event owner.
begin;

alter table public.events add column if not exists starts_at timestamptz;
alter table public.events add column if not exists ends_at timestamptz;

alter table public.events drop constraint if exists events_schedule_order_check;
alter table public.events
  add constraint events_schedule_order_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

commit;
