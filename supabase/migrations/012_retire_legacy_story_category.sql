-- Retire the original three-value story category in favor of content_taxa/story_taxa.
-- Keep the nullable column temporarily so this migration can be deployed before the app update.

-- Daily life is content classification now, not a special application route.
update public.content_taxa
set kind = 'topic',
    href = null,
    aliases = array(select distinct alias_value from unnest(aliases || array['日常生活']) as alias(alias_value)),
    updated_at = now()
where slug = 'daily-life';

-- Preserve the meaning of existing daily-life stories in the new taxonomy relation.
insert into public.story_taxa (story_id, taxon_id)
select stories.id, taxon.id
from public.stories as stories
cross join public.content_taxa as taxon
where stories.category = '日常生活'
  and taxon.slug = 'daily-life'
on conflict (story_id, taxon_id) do nothing;

alter table public.stories drop constraint if exists stories_category_check;
alter table public.stories alter column category drop not null;
comment on column public.stories.category is
  'Deprecated legacy import field. Application classification is stored in story_taxa.';
