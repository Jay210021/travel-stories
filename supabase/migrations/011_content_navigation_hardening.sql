-- Unify system links and taxonomy nodes in one ordered navigation source.
alter table public.content_taxa add column if not exists href text;
alter table public.content_taxa drop constraint if exists content_taxa_kind_check;
alter table public.content_taxa add constraint content_taxa_kind_check check (kind in ('destination', 'topic', 'system'));
alter table public.content_taxa drop constraint if exists content_taxa_target_check;
alter table public.content_taxa add constraint content_taxa_target_check check (
  (kind = 'system' and parent_id is null and href is not null)
  or (kind in ('destination', 'topic') and href is null)
);

create unique index if not exists content_taxa_sibling_label_idx
  on public.content_taxa(coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(label));

insert into public.content_taxa(slug, label, kind, href, show_in_nav, sort_order)
values
  ('daily-life', '日常生活', 'system', '/categories/daily-life', true, 50),
  ('videos', '影片專區', 'system', '/videos', true, 60)
on conflict (slug) do update set label = excluded.label, kind = excluded.kind, href = excluded.href;

create or replace function public.reorder_content_taxa(p_parent_id uuid, p_taxon_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare expected_count integer;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  select count(*) into expected_count from public.content_taxa where parent_id is not distinct from p_parent_id;
  if expected_count <> cardinality(p_taxon_ids)
    or (select count(*) from public.content_taxa where parent_id is not distinct from p_parent_id and id = any(p_taxon_ids)) <> expected_count
    or (select count(distinct ids.id) from unnest(p_taxon_ids) as ids(id)) <> expected_count
  then raise exception 'classification list does not match siblings'; end if;
  update public.content_taxa
  set sort_order = (ordered.position * 10)::integer, updated_at = now()
  from unnest(p_taxon_ids) with ordinality as ordered(id, position)
  where content_taxa.id = ordered.id;
end;
$$;

create or replace function public.set_story_taxa(p_story_id uuid, p_taxon_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.stories where id = p_story_id) then raise exception 'story not found'; end if;
  if (select count(*) from public.content_taxa where id = any(p_taxon_ids)) <> cardinality(p_taxon_ids)
    or (select count(distinct ids.id) from unnest(p_taxon_ids) as ids(id)) <> cardinality(p_taxon_ids)
  then raise exception 'invalid classifications'; end if;
  delete from public.story_taxa where story_id = p_story_id;
  insert into public.story_taxa(story_id, taxon_id) select p_story_id, ids.id from unnest(p_taxon_ids) as ids(id);
end;
$$;

grant execute on function public.reorder_content_taxa(uuid, uuid[]) to authenticated;
grant execute on function public.set_story_taxa(uuid, uuid[]) to authenticated;
