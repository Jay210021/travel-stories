create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table if not exists public.author_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.is_author()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.author_allowlist
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'website',
  source_id text unique,
  slug text unique,
  title text not null,
  body text not null default '',
  category text not null check (category in ('國外旅行', '台灣旅行', '日常生活')),
  country text,
  city text,
  attraction text,
  journey_series text,
  cover_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'trash')),
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  sort_order integer not null default 0,
  caption text not null default '',
  alt_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists stories_search_idx on public.stories using gin ((title || ' ' || body || ' ' || coalesce(country, '') || ' ' || coalesce(city, '')) gin_trgm_ops);
create index if not exists stories_status_idx on public.stories(status, published_at desc);
create index if not exists story_media_story_idx on public.story_media(story_id, sort_order);

alter table public.author_allowlist enable row level security;
alter table public.stories enable row level security;
alter table public.story_media enable row level security;

drop policy if exists "public can read published stories" on public.stories;
create policy "public can read published stories" on public.stories for select using (status = 'published');
drop policy if exists "authors manage stories" on public.stories;
create policy "authors manage stories" on public.stories for all using (public.is_author()) with check (public.is_author());

drop policy if exists "public can read media for published stories" on public.story_media;
create policy "public can read media for published stories" on public.story_media for select using (exists (select 1 from public.stories where stories.id = story_media.story_id and stories.status = 'published'));
drop policy if exists "authors manage media" on public.story_media;
create policy "authors manage media" on public.story_media for all using (public.is_author()) with check (public.is_author());

insert into storage.buckets (id, name, public) values ('travel-photos', 'travel-photos', true), ('travel-videos', 'travel-videos', true) on conflict (id) do nothing;

-- Add the two authors' Google email addresses here before using the author RLS policies:
-- insert into public.author_allowlist(email) values ('your-email@example.com'), ('partner-email@example.com');
