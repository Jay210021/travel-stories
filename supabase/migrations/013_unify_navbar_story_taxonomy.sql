-- Make Navbar destinations and story classifications use the same content_taxa rows.
with destination_items(slug, label, parent_slug, aliases, sort_order) as (
  values
    ('italy', '義大利', 'europe', array['義大利', '米蘭', '威尼斯', '羅馬'], 10),
    ('croatia', '克羅埃西亞', 'europe', array['克羅埃西亞', '杜布羅夫尼克', '札達爾', '斯普利特'], 20),
    ('slovenia', '斯洛維尼亞', 'europe', array['斯洛維尼亞', '盧比安納'], 30),
    ('montenegro', '蒙特內哥羅', 'europe', array['蒙特內哥羅', '科托爾'], 40),
    ('hungary', '匈牙利', 'europe', array['匈牙利', '布達佩斯'], 50),
    ('poland', '波蘭', 'europe', array['波蘭', '華沙', '克拉科夫'], 60),
    ('czechia', '捷克', 'europe', array['捷克', '布拉格'], 70),
    ('germany', '德國', 'europe', array['德國', '慕尼黑'], 80),
    ('austria', '奧地利', 'europe', array['奧地利', '維也納', '薩爾斯堡'], 90),
    ('slovakia', '斯洛伐克', 'europe', array['斯洛伐克', '布拉提斯拉瓦'], 100),
    ('spain', '西班牙', 'europe', array['西班牙', '巴塞隆納', '馬德里'], 110),
    ('portugal', '葡萄牙', 'europe', array['葡萄牙', '里斯本', '波多'], 120),
    ('greece', '希臘', 'europe', array['希臘', '聖托里尼'], 130),
    ('finland', '芬蘭', 'europe', array['芬蘭', '赫爾辛基'], 140),
    ('south-korea', '韓國', 'asia', array['韓國', '首爾', '釜山'], 10),
    ('vietnam', '越南', 'asia', array['越南', '河內', '胡志明市', '峴港'], 20),
    ('thailand', '泰國', 'asia', array['泰國', '曼谷'], 30),
    ('laos', '寮國', 'asia', array['寮國', '龍坡邦'], 40),
    ('india', '印度', 'asia', array['印度', '新德里', '孟買'], 50),
    ('china', '中國', 'asia', array['中國', '北京', '上海'], 60),
    ('united-arab-emirates', '阿拉伯聯合大公國', 'asia', array['阿拉伯聯合大公國', '阿聯酋', '杜拜'], 70),
    ('turkey', '土耳其', 'asia', array['土耳其', '伊斯坦堡'], 80),
    ('egypt', '埃及', 'africa', array['埃及', '開羅'], 10),
    ('kenya', '肯亞', 'africa', array['肯亞', '奈洛比'], 20)
)
insert into public.content_taxa(slug, label, kind, parent_id, aliases, show_in_nav, sort_order)
select item.slug, item.label, 'destination', parent.id, item.aliases, true, item.sort_order
from destination_items as item
join public.content_taxa as parent on parent.slug = item.parent_slug
on conflict (slug) do update set
  label = excluded.label,
  kind = 'destination',
  parent_id = excluded.parent_id,
  aliases = excluded.aliases,
  show_in_nav = true,
  sort_order = excluded.sort_order,
  href = null,
  updated_at = now();

-- Preserve existing country data as a new classification when the story has no classification yet.
insert into public.story_taxa(story_id, taxon_id)
select story.id, taxon.id
from public.stories as story
join public.content_taxa as taxon
  on taxon.parent_id is not null
 and exists (
   select 1 from unnest(taxon.aliases) as alias(value)
   where lower(trim(alias.value)) = lower(trim(story.country))
 )
where story.country is not null
  and not exists (select 1 from public.story_taxa where story_taxa.story_id = story.id)
on conflict (story_id, taxon_id) do nothing;
