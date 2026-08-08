-- Storage permissions for public playback and author-managed uploads.
drop policy if exists "public reads travel media" on storage.objects;
create policy "public reads travel media" on storage.objects for select
using (bucket_id in ('travel-photos', 'travel-videos'));

drop policy if exists "authors manage travel media" on storage.objects;
create policy "authors manage travel media" on storage.objects for all
using (bucket_id in ('travel-photos', 'travel-videos') and public.is_author())
with check (bucket_id in ('travel-photos', 'travel-videos') and public.is_author());

-- Anonymous aggregate-friendly page views. No visitor identifier is stored.
create table if not exists public.story_views (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists story_views_story_date_idx on public.story_views(story_id, viewed_at desc);
alter table public.story_views enable row level security;
drop policy if exists "visitors record published story views" on public.story_views;
create policy "visitors record published story views" on public.story_views for insert
with check (exists (select 1 from public.stories where stories.id = story_id and stories.status = 'published'));
drop policy if exists "authors read story views" on public.story_views;
create policy "authors read story views" on public.story_views for select using (public.is_author());

-- Can be called by a trusted scheduled task; keeps recoverable trash for 30 days.
create or replace function public.purge_expired_story_trash()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  delete from public.stories where status = 'trash' and deleted_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
