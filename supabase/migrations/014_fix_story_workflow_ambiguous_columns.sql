-- Qualify stories columns because RETURNS TABLE creates variables with the same names.
create or replace function public.apply_story_workflow(workflow_action text, story_ids uuid[])
returns table(id uuid, status text, published_at timestamptz, deleted_at timestamptz, slug text)
language plpgsql security definer set search_path = public as $$
declare target_count integer;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  if workflow_action not in ('publish', 'unpublish', 'trash', 'restore') then raise exception 'invalid workflow action'; end if;
  if coalesce(cardinality(story_ids), 0) = 0 then raise exception 'no stories selected'; end if;
  if (select count(distinct item.story_id) from unnest(story_ids) as item(story_id)) <> cardinality(story_ids) then raise exception 'duplicate story ids'; end if;

  select count(*) into target_count
  from public.stories as target
  where target.id = any(story_ids)
    and case workflow_action
      when 'publish' then target.status in ('draft', 'published')
      when 'unpublish' then target.status = 'published'
      when 'trash' then target.status in ('draft', 'published')
      when 'restore' then target.status = 'trash'
    end;
  if target_count <> cardinality(story_ids) then raise exception 'one or more stories cannot make this transition'; end if;

  if workflow_action = 'publish' then
    update public.stories as target
    set status = 'published',
        slug = coalesce(target.slug, 'story-' || replace(target.id::text, '-', '')),
        published_at = coalesce(target.published_at, now()),
        deleted_at = null,
        updated_at = now()
    where target.id = any(story_ids);
  elsif workflow_action = 'unpublish' then
    update public.stories as target set status = 'draft', updated_at = now()
    where target.id = any(story_ids);
  elsif workflow_action = 'trash' then
    update public.stories as target set status = 'trash', deleted_at = now(), updated_at = now()
    where target.id = any(story_ids);
  else
    update public.stories as target set status = 'draft', deleted_at = null, updated_at = now()
    where target.id = any(story_ids);
  end if;

  return query
  select target.id, target.status, target.published_at, target.deleted_at, target.slug
  from public.stories as target
  where target.id = any(story_ids);
end;
$$;

grant execute on function public.apply_story_workflow(text, uuid[]) to authenticated;
