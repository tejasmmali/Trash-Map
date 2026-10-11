-- Trash Map: reports table and image storage bucket.
-- Mirrors the shared contract in src/lib/validation/reports.ts.

create type public.report_category as enum ('plastic', 'organic', 'construction', 'mixed', 'other');
create type public.report_status as enum ('pending', 'in_progress', 'resolved');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  category public.report_category not null,
  description text check (char_length(description) <= 1000),
  confidence real check (confidence between 0 and 1),
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  ai_analysis jsonb,
  is_sample boolean not null default false,
  constraint resolved_at_matches_status check ((status = 'resolved') = (resolved_at is not null))
);

create index reports_status_created_at_idx on public.reports (status, created_at desc);

-- All reads and writes go through Next.js route handlers using the service-role
-- key, so RLS is enabled with no policies: anon/authenticated clients get nothing.
alter table public.reports enable row level security;

-- Public-read bucket so stored image URLs can be rendered directly.
-- Uploads happen server-side with the service-role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-images', 'report-images', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
