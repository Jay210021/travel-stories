-- BYPASSRLS does not grant table privileges. Migration 015 only granted reads
-- to authenticated; installations with restricted default privileges fail 42501.
begin;
grant select, update on public.facebook_sync_settings to service_role;
grant select, insert, update, delete on
  public.facebook_imports, public.facebook_import_events to service_role;
grant select, insert on
  public.facebook_import_attempts, public.facebook_removed_media to service_role;
grant usage, select on sequence
  public.facebook_import_attempts_id_seq,
  public.facebook_removed_media_id_seq,
  public.facebook_import_events_id_seq to service_role;
commit;
