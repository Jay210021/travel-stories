-- A single hierarchy for travel destinations and non-travel topics.
create table if not exists public.content_taxa (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (char_length(trim(label)) between 1 and 60),
  kind text not null check (kind in ('destination', 'topic')),
  parent_id uuid references public.content_taxa(id) on delete cascade,
  aliases text[] not null default '{}',
  show_in_nav boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_taxa_parent_order_idx on public.content_taxa(parent_id, sort_order, label);

create table if not exists public.story_taxa (
  story_id uuid not null references public.stories(id) on delete cascade,
  taxon_id uuid not null references public.content_taxa(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, taxon_id)
);

alter table public.content_taxa enable row level security;
alter table public.story_taxa enable row level security;
drop policy if exists "public reads content taxa" on public.content_taxa;
create policy "public reads content taxa" on public.content_taxa for select using (true);
drop policy if exists "authors manage content taxa" on public.content_taxa;
create policy "authors manage content taxa" on public.content_taxa for all using (public.is_author()) with check (public.is_author());
drop policy if exists "public reads published story taxa" on public.story_taxa;
create policy "public reads published story taxa" on public.story_taxa for select using (exists (select 1 from public.stories where stories.id = story_taxa.story_id and stories.status = 'published'));
drop policy if exists "authors manage story taxa" on public.story_taxa;
create policy "authors manage story taxa" on public.story_taxa for all using (public.is_author()) with check (public.is_author());
grant select on public.content_taxa, public.story_taxa to anon, authenticated;
grant insert, update, delete on public.content_taxa, public.story_taxa to authenticated;

-- Make the current geographic roots available in the new manager.
insert into public.content_taxa (slug, label, kind, show_in_nav, sort_order)
values ('europe', '歐洲', 'destination', true, 10), ('asia', '亞洲', 'destination', true, 20), ('africa', '非洲', 'destination', true, 30), ('taiwan', '台灣', 'destination', true, 40)
on conflict (slug) do nothing;
