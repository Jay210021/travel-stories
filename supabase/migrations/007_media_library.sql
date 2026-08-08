-- MediaLibrary keeps media rows and cover_path in one database transaction.
create table if not exists public.media_storage_cleanup (
  id bigint generated always as identity primary key,
  storage_path text not null unique,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.media_storage_cleanup enable row level security;

create or replace function public.attach_story_media(p_story_id uuid, p_kind text, p_storage_path text, p_caption text default '', p_alt_text text default '')
returns public.story_media language plpgsql security definer set search_path = public as $$
declare item public.story_media;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  if p_kind not in ('photo', 'video') then raise exception 'invalid media kind'; end if;
  insert into public.story_media(story_id, kind, storage_path, sort_order, caption, alt_text)
  values (p_story_id, p_kind, p_storage_path, coalesce((select max(sort_order) + 1 from public.story_media where story_id = p_story_id), 0), p_caption, p_alt_text)
  returning * into item;
  if p_kind = 'photo' and (select cover_path is null from public.stories where id = p_story_id) then
    update public.stories set cover_path = p_storage_path, updated_at = now() where id = p_story_id;
  end if;
  return item;
end;
$$;

create or replace function public.reorder_story_media(p_story_id uuid, p_media_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare expected_count integer;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  select count(*) into expected_count from public.story_media where story_id = p_story_id;
  if expected_count <> cardinality(p_media_ids) or (select count(*) from public.story_media where story_id = p_story_id and id = any(p_media_ids)) <> expected_count then raise exception 'media list does not match story'; end if;
  update public.story_media set sort_order = ordered.position - 1 from unnest(p_media_ids) with ordinality as ordered(id, position) where story_media.id = ordered.id;
  update public.stories set cover_path = (select storage_path from public.story_media where story_id = p_story_id and kind = 'photo' order by sort_order limit 1), updated_at = now() where id = p_story_id;
end;
$$;

create or replace function public.detach_story_media(p_media_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare path text; parent_id uuid;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  select storage_path, story_id into path, parent_id from public.story_media where id = p_media_id;
  if path is null then raise exception 'media not found'; end if;
  delete from public.story_media where id = p_media_id;
  update public.stories set cover_path = (select storage_path from public.story_media where story_id = parent_id and kind = 'photo' order by sort_order limit 1), updated_at = now() where id = parent_id;
  return path;
end;
$$;

create or replace function public.queue_media_storage_cleanup(p_storage_path text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  insert into public.media_storage_cleanup(storage_path, reason) values (p_storage_path, p_reason) on conflict (storage_path) do nothing;
end;
$$;

grant execute on function public.attach_story_media(uuid, text, text, text, text) to authenticated;
grant execute on function public.reorder_story_media(uuid, uuid[]) to authenticated;
grant execute on function public.detach_story_media(uuid) to authenticated;
grant execute on function public.queue_media_storage_cleanup(text, text) to authenticated;
