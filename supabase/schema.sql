-- Run this once in the Supabase SQL editor.
create table if not exists public.incidents (
  id          text primary key,
  created_at  bigint not null,          -- epoch milliseconds
  updated_at  bigint not null,
  status      text not null default 'new' check (status in ('new', 'dispatched', 'on_scene', 'resolved')),
  source      text not null default 'dispatcher' check (source in ('dispatcher', 'citizen')),
  message     text not null,
  gps         jsonb,
  result      jsonb,
  units       jsonb not null default '[]'::jsonb,
  dispatch    jsonb,
  assigned    jsonb not null default '[]'::jsonb
);

create index if not exists incidents_created_at_idx on public.incidents (created_at desc);
create index if not exists incidents_status_idx on public.incidents (status);

-- The app talks to this table only from the server with the service-role key, which bypasses RLS.
-- Enabling RLS with no policies keeps the table closed to the public anon key (messages and GPS are sensitive).
alter table public.incidents enable row level security;
