create table if not exists public.managed_destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (char_length(trim(label)) between 1 and 60),
  region_slug text not null check (region_slug in ('europe', 'asia', 'africa', 'taiwan')),
  aliases text[] not null default '{}',
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.managed_destinations enable row level security;
drop policy if exists "public reads visible managed destinations" on public.managed_destinations;
create policy "public reads visible managed destinations" on public.managed_destinations for select using (is_visible = true);
drop policy if exists "authors manage destinations" on public.managed_destinations;
create policy "authors manage destinations" on public.managed_destinations for all using (public.is_author()) with check (public.is_author());
grant select on public.managed_destinations to anon, authenticated;
grant insert, update, delete on public.managed_destinations to authenticated;
