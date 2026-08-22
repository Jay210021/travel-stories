-- Keep draft and trashed media private. Public pages use short-lived signed URLs.
update storage.buckets
set public = false
where id in ('travel-photos', 'travel-videos');

drop policy if exists "public reads travel media" on storage.objects;

-- Anonymous clients no longer write unbounded raw view events directly.
drop policy if exists "visitors record published story views" on public.story_views;
revoke insert on public.story_views from anon, authenticated;

create table if not exists public.story_view_dedup (
  story_id uuid not null references public.stories(id) on delete cascade,
  view_key text not null check (char_length(view_key) = 64),
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (story_id, view_key, viewed_on)
);
alter table public.story_view_dedup enable row level security;
revoke all on public.story_view_dedup from public, anon, authenticated;

create or replace function public.record_story_view(p_story_id uuid, p_view_key text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if char_length(coalesce(p_view_key, '')) <> 64 then raise exception 'invalid view key'; end if;
  if not exists (select 1 from public.stories where id = p_story_id and status = 'published') then return false; end if;
  insert into public.story_view_dedup(story_id, view_key) values (p_story_id, p_view_key)
  on conflict do nothing;
  if not found then return false; end if;
  insert into public.story_views(story_id) values (p_story_id);
  delete from public.story_view_dedup where viewed_on < current_date - 2;
  return true;
end;
$$;
revoke all on function public.record_story_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_story_view(uuid, text) to service_role;
