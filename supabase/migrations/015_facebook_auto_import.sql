-- Durable Facebook Page import queue, current state and append-only attempt history.
alter table public.stories add column if not exists editorial_updated_at timestamptz;
alter table public.stories add column if not exists title_confirmed boolean not null default true;

create table if not exists public.facebook_sync_settings (
  singleton boolean primary key default true check (singleton),
  page_id text,
  state text not null default 'disconnected' check (state in ('disconnected', 'testing', 'active', 'interrupted')),
  activated_at timestamptz,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  graph_api_version text not null default 'v24.0',
  updated_at timestamptz not null default now()
);
insert into public.facebook_sync_settings(singleton) values (true) on conflict (singleton) do nothing;

create table if not exists public.facebook_imports (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  post_id text not null,
  story_id uuid references public.stories(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'needs_attention', 'failed', 'update_pending', 'source_removed')),
  source_permalink text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_snapshot jsonb,
  pending_snapshot jsonb,
  suggested_taxon_id uuid references public.content_taxa(id) on delete set null,
  possible_duplicate_story_id uuid references public.stories(id) on delete set null,
  attention_reason text,
  imported_photo_ids text[] not null default '{}',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id, post_id)
);
create index if not exists facebook_imports_status_retry_idx on public.facebook_imports(status, next_attempt_at);
create index if not exists facebook_imports_story_idx on public.facebook_imports(story_id);

create table if not exists public.facebook_import_attempts (
  id bigint generated always as identity primary key,
  import_id uuid references public.facebook_imports(id) on delete cascade,
  page_id text not null,
  post_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  outcome text not null check (outcome in ('succeeded', 'needs_attention', 'failed', 'update_pending', 'source_removed')),
  stage text not null,
  error_code text,
  error_reason text,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists facebook_import_attempts_recent_idx on public.facebook_import_attempts(created_at desc);
create index if not exists facebook_import_attempts_post_idx on public.facebook_import_attempts(page_id, post_id, created_at desc);

create table if not exists public.facebook_removed_media (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.facebook_imports(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  source_media_id text not null,
  original_storage_path text not null,
  trashed_storage_path text not null,
  removed_at timestamptz not null default now()
);

create table if not exists public.facebook_import_events (
  id bigint generated always as identity primary key,
  page_id text not null,
  post_id text not null,
  kind text not null check (kind in ('upsert', 'remove')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  received_at timestamptz not null,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists facebook_import_events_queue_idx on public.facebook_import_events(status, received_at);

create or replace function public.claim_facebook_import_event(p_event_id bigint)
returns public.facebook_import_events language plpgsql security definer set search_path = public as $$
declare claimed public.facebook_import_events;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  update public.facebook_import_events
  set status = 'processing', attempt_count = attempt_count + 1, updated_at = now()
  where id = p_event_id and status in ('pending', 'failed') and attempt_count < 3
  returning * into claimed;
  return claimed;
end;
$$;
grant execute on function public.claim_facebook_import_event(bigint) to service_role;

alter table public.facebook_sync_settings enable row level security;
alter table public.facebook_imports enable row level security;
alter table public.facebook_import_attempts enable row level security;
alter table public.facebook_removed_media enable row level security;
alter table public.facebook_import_events enable row level security;
create policy "authors read Facebook sync settings" on public.facebook_sync_settings for select using (public.is_author());
create policy "authors read Facebook imports" on public.facebook_imports for select using (public.is_author());
create policy "authors read Facebook import attempts" on public.facebook_import_attempts for select using (public.is_author());
create policy "authors read removed Facebook media" on public.facebook_removed_media for select using (public.is_author());
grant select on public.facebook_sync_settings, public.facebook_imports, public.facebook_import_attempts, public.facebook_removed_media to authenticated;

create or replace function public.save_facebook_editorial_story(p_story_id uuid, p_title text, p_body text, p_published_at timestamptz, p_taxon_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  if char_length(trim(coalesce(p_title, ''))) = 0 then raise exception 'title is required'; end if;
  if not exists (select 1 from public.stories where id = p_story_id and source_id like 'facebook-live:%') then raise exception 'Facebook import story not found'; end if;
  if not exists (select 1 from public.content_taxa where id = p_taxon_id and show_in_nav and kind <> 'system') then raise exception 'invalid story classification'; end if;
  if exists (select 1 from public.content_taxa where parent_id = p_taxon_id and show_in_nav) then raise exception 'select a child classification'; end if;
  update public.stories set title = trim(p_title), body = coalesce(p_body, ''), published_at = p_published_at,
    title_confirmed = true, editorial_updated_at = now(), updated_at = now() where id = p_story_id;
  delete from public.story_taxa where story_id = p_story_id;
  insert into public.story_taxa(story_id, taxon_id) values (p_story_id, p_taxon_id);
end;
$$;
grant execute on function public.save_facebook_editorial_story(uuid, text, text, timestamptz, uuid) to authenticated;

create or replace function public.link_facebook_import_to_story(p_import_id uuid, p_story_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare imported_story_id uuid;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.stories where id = p_story_id) then raise exception 'target story not found'; end if;
  select story_id into imported_story_id from public.facebook_imports where id = p_import_id for update;
  if not found then raise exception 'Facebook import not found'; end if;
  update public.facebook_imports set story_id = p_story_id, possible_duplicate_story_id = null, updated_at = now() where id = p_import_id;
  if imported_story_id is not null and imported_story_id <> p_story_id then
    update public.stories set status = 'trash', deleted_at = now(), updated_at = now()
    where id = imported_story_id and source_id like 'facebook-live:%' and status = 'draft';
  end if;
end;
$$;
grant execute on function public.link_facebook_import_to_story(uuid, uuid) to authenticated;

create or replace function public.apply_story_workflow(workflow_action text, story_ids uuid[])
returns table(id uuid, status text, published_at timestamptz, deleted_at timestamptz, slug text)
language plpgsql security definer set search_path = public as $$
declare target_count integer;
begin
  if not public.is_author() then raise exception 'not authorized'; end if;
  if workflow_action not in ('publish', 'unpublish', 'trash', 'restore') then raise exception 'invalid workflow action'; end if;
  if coalesce(cardinality(story_ids), 0) = 0 then raise exception 'no stories selected'; end if;
  if (select count(distinct item.story_id) from unnest(story_ids) as item(story_id)) <> cardinality(story_ids) then raise exception 'duplicate story ids'; end if;

  if workflow_action = 'publish' and exists (
    select 1 from public.stories as story
    where story.id = any(story_ids)
      and story.source_id like 'facebook-live:%'
      and (not story.title_confirmed or not exists (select 1 from public.story_taxa where story_taxa.story_id = story.id))
  ) then raise exception 'Facebook 匯入草稿必須先確認標題與分類'; end if;

  select count(*) into target_count from public.stories as target
  where target.id = any(story_ids) and case workflow_action
    when 'publish' then target.status in ('draft', 'published')
    when 'unpublish' then target.status = 'published'
    when 'trash' then target.status in ('draft', 'published')
    when 'restore' then target.status = 'trash'
  end;
  if target_count <> cardinality(story_ids) then raise exception 'one or more stories cannot make this transition'; end if;

  if workflow_action = 'publish' then
    update public.stories as target set status = 'published', slug = coalesce(target.slug, 'story-' || replace(target.id::text, '-', '')), published_at = coalesce(target.published_at, now()), deleted_at = null, updated_at = now() where target.id = any(story_ids);
  elsif workflow_action = 'unpublish' then
    update public.stories as target set status = 'draft', updated_at = now() where target.id = any(story_ids);
  elsif workflow_action = 'trash' then
    update public.stories as target set status = 'trash', deleted_at = now(), updated_at = now() where target.id = any(story_ids);
  else
    update public.stories as target set status = 'draft', deleted_at = null, updated_at = now() where target.id = any(story_ids);
  end if;
  return query select target.id, target.status, target.published_at, target.deleted_at, target.slug from public.stories as target where target.id = any(story_ids);
end;
$$;

create or replace function public.purge_expired_facebook_import_attempts()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  if auth.role() <> 'service_role' and not public.is_author() then raise exception 'not authorized'; end if;
  delete from public.facebook_import_attempts where created_at < now() - interval '180 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
grant execute on function public.purge_expired_facebook_import_attempts() to authenticated, service_role;
