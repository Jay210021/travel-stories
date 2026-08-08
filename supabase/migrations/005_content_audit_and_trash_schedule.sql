-- Durable content activity log. It can later feed an Email webhook without changing CMS actions.
create table if not exists public.content_events (
  id bigint generated always as identity primary key,
  story_id uuid references public.stories(id) on delete set null,
  source_id text,
  action text not null check (action in ('created', 'updated', 'published', 'unpublished', 'trashed', 'restored')),
  actor_email text,
  created_at timestamptz not null default now()
);
create index if not exists content_events_created_idx on public.content_events(created_at desc);
alter table public.content_events enable row level security;
drop policy if exists "authors read content events" on public.content_events;
create policy "authors read content events" on public.content_events for select using (public.is_author());

create or replace function public.record_story_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_action text;
begin
  if tg_op = 'INSERT' then event_action := 'created';
  elsif old.status <> new.status then
    event_action := case
      when new.status = 'published' then 'published'
      when old.status = 'published' and new.status = 'draft' then 'unpublished'
      when new.status = 'trash' then 'trashed'
      when old.status = 'trash' then 'restored'
      else 'updated'
    end;
  else event_action := 'updated';
  end if;
  insert into public.content_events(story_id, source_id, action, actor_email)
  values (new.id, new.source_id, event_action, auth.jwt() ->> 'email');
  return new;
end;
$$;
drop trigger if exists stories_record_activity on public.stories;
create trigger stories_record_activity after insert or update on public.stories
for each row execute function public.record_story_event();

-- Internal purge function: only postgres/service roles and pg_cron may execute it.
create or replace function public.purge_expired_story_trash_internal()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.stories where status = 'trash' and deleted_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_expired_story_trash_internal() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge-expired-story-trash') then
    perform cron.schedule('purge-expired-story-trash', '20 3 * * *', 'select public.purge_expired_story_trash_internal();');
  end if;
end $$;
