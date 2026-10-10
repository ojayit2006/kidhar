-- Ticket system: priority, flags, owner, notes/activity log, escalation and resolution live in one jsonb column.
-- Run once in the Supabase SQL editor. Existing incidents keep working: a default ticket is derived for them.
alter table public.incidents add column if not exists ticket jsonb;
