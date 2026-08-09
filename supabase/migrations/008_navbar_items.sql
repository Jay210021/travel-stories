create table if not exists public.navbar_items (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(trim(label)) between 1 and 40),
  item_type text not null check (item_type in ('link', 'destination')),
  href text,
  destination_region text check (destination_region in ('europe', 'asia', 'africa', 'taiwan')),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_type = 'link' and href is not null and destination_region is null)
    or (item_type = 'destination' and href is null and destination_region is not null)
  )
);

create index if not exists navbar_items_visible_order_idx
  on public.navbar_items(is_visible, sort_order, created_at);

alter table public.navbar_items enable row level security;

drop policy if exists "public reads visible navbar items" on public.navbar_items;
create policy "public reads visible navbar items" on public.navbar_items
  for select using (is_visible = true);

drop policy if exists "authors manage navbar items" on public.navbar_items;
create policy "authors manage navbar items" on public.navbar_items
  for all using (public.is_author()) with check (public.is_author());

-- RLS policies decide which rows can be used; these grants allow the API roles
-- to access the table in the first place.
grant select on public.navbar_items to anon, authenticated;
grant insert, update, delete on public.navbar_items to authenticated;

insert into public.navbar_items (label, item_type, href, destination_region, sort_order)
select item.label, item.item_type, item.href, item.destination_region, item.sort_order
from (values
  ('歐洲', 'destination', null, 'europe', 10),
  ('亞洲', 'destination', null, 'asia', 20),
  ('非洲', 'destination', null, 'africa', 30),
  ('台灣', 'destination', null, 'taiwan', 40),
  ('日常生活', 'link', '/categories/daily-life', null, 50),
  ('影片專區', 'link', '/videos', null, 60)
) as item(label, item_type, href, destination_region, sort_order)
where not exists (select 1 from public.navbar_items);
