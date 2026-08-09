import { createClient } from "@supabase/supabase-js";
import { destinationNavigation, resolveDestination, type DestinationNavigation, type RegionSlug } from "@/lib/destination";
import type { PublicNavbarItem } from "@/lib/navbar-types";
import { descendantIds } from "@/lib/content-taxonomy-order";

type StoryRow = { id: string; source_id: string | null; slug: string | null; title: string; body: string; category: string; country: string | null; city: string | null; published_at: string | null; cover_path: string | null };
export type PublicStoryCard = Omit<StoryRow, "slug"> & { slug: string };
export type PublicStory = PublicStoryCard & { media: PublicMedia[] };
export type PublicMedia = { kind: "photo" | "video"; storage_path: string; caption: string; alt_text: string };
export type PublicVideo = PublicMedia & { story: PublicStoryCard };
export type PublicNavigation = DestinationNavigation;
export type ManagedDestination = { slug: string; label: string; region_slug: RegionSlug; aliases: string[] };
export type PublicTaxon = { id: string; slug: string; label: string; kind: "destination" | "topic"; parent_id: string | null; aliases: string[] };
type NavbarRow = { id: string; label: string; item_type: "link" | "destination"; href: string | null; destination_region: RegionSlug | null };
type TaxonRow = { id: string; slug: string; label: string; kind: "destination" | "topic" | "system"; parent_id: string | null; show_in_nav: boolean; sort_order: number; href: string | null };

const storyFields = "id,source_id,slug,title,body,category,country,city,published_at,cover_path";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public reading configuration is missing.");
  return createClient(url, key);
}

function normalizeStory(story: StoryRow): PublicStoryCard {
  return { ...story, slug: story.slug || `story-${story.id.replaceAll("-", "")}` };
}

async function readPublishedStoryCards(): Promise<PublicStoryCard[]> {
  const { data, error } = await getSupabase().from("stories").select(storyFields).eq("status", "published").order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeStory);
}

export async function listStoryIndex() {
  return readPublishedStoryCards();
}

export async function getStoryBySlug(slug: string): Promise<PublicStory | null> {
  const { data: story, error } = await getSupabase().from("stories").select(storyFields).eq("status", "published").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!story) return null;
  const { data: media, error: mediaError } = await getSupabase().from("story_media").select("kind,storage_path,caption,alt_text").eq("story_id", story.id).order("sort_order");
  if (mediaError) throw mediaError;
  return { ...normalizeStory(story), media: (media ?? []) as PublicMedia[] };
}

export async function listStoriesForRegion(region: RegionSlug) {
  return (await readPublishedStoryCards()).filter((story) => resolveDestination(story)?.region.slug === region);
}

export async function listStoriesForCountry(country: string) {
  return (await readPublishedStoryCards()).filter((story) => resolveDestination(story)?.country?.slug === country || resolveDestination(story)?.region.slug === country);
}

export async function listStoriesForCategory(category: string) {
  const { data, error } = await getSupabase().from("stories").select(storyFields).eq("status", "published").eq("category", category).order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeStory);
}

export async function getManagedDestination(slug: string): Promise<ManagedDestination | null> {
  const { data, error } = await getSupabase().from("managed_destinations").select("slug,label,region_slug,aliases").eq("slug", slug).eq("is_visible", true).maybeSingle();
  if (error || !data) return null;
  return data as ManagedDestination;
}

export async function listStoriesForManagedDestination(destination: ManagedDestination) {
  const aliases = destination.aliases.map((alias) => alias.toLowerCase());
  return (await readPublishedStoryCards()).filter((story) => [story.country ?? "", story.title, story.body].some((value) => aliases.some((alias) => value.toLowerCase().includes(alias))));
}

export async function getPublicTaxon(slug: string): Promise<PublicTaxon | null> {
  const { data, error } = await getSupabase().from("content_taxa").select("id,slug,label,kind,parent_id,aliases").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return data as PublicTaxon;
}

export async function listStoriesForTaxon(taxon: PublicTaxon) {
  const { data: allTaxa } = await getSupabase().from("content_taxa").select("id,label,parent_id,aliases");
  const descendants = descendantIds(allTaxa ?? [], taxon.id);
  const relatedTaxa = (allTaxa ?? []).filter((item) => descendants.has(item.id));
  const { data: assignments } = await getSupabase().from("story_taxa").select("story_id").in("taxon_id", [...descendants]);
  const assigned = new Set((assignments ?? []).map((item) => item.story_id));
  const aliases = [...new Set([taxon.label, ...taxon.aliases, ...relatedTaxa.flatMap((item) => [item.label, ...(item.aliases ?? [])])])].map((alias) => alias.toLowerCase());
  return (await readPublishedStoryCards()).filter((story) => assigned.has(story.id) || [story.country ?? "", story.category, story.title, story.body].some((value) => aliases.some((alias) => value.toLowerCase().includes(alias))));
}

export async function getPublicTaxonCrumbs(taxon: PublicTaxon) {
  const { data } = await getSupabase().from("content_taxa").select("id,slug,label,parent_id");
  const byId = new Map((data ?? []).map((item) => [item.id, item])); const ancestors: { label: string; href: string }[] = [];
  let parent = taxon.parent_id ? byId.get(taxon.parent_id) : null;
  while (parent) { ancestors.unshift({ label: parent.label, href: `/collections/${parent.slug}` }); parent = parent.parent_id ? byId.get(parent.parent_id) : null; }
  return ancestors;
}

export async function listVideos(): Promise<PublicVideo[]> {
  const { data, error } = await getSupabase().from("story_media").select(`kind,storage_path,caption,alt_text,stories!inner(${storyFields})`).eq("kind", "video").order("sort_order");
  if (error) throw error;
  return (data ?? []).flatMap((media) => {
    const story = Array.isArray(media.stories) ? media.stories[0] : media.stories;
    return story ? [{ kind: media.kind as PublicMedia["kind"], storage_path: media.storage_path, caption: media.caption, alt_text: media.alt_text, story: normalizeStory(story as StoryRow) }] : [];
  });
}

export async function getPublicNavigation(): Promise<PublicNavigation> {
  return destinationNavigation(await readPublishedStoryCards());
}

export async function getPublicNavbarItems(): Promise<PublicNavbarItem[]> {
  const navigation = await getPublicNavigation();
  const fallback: PublicNavbarItem[] = [
    ...navigation.map((region) => ({ id: region.slug, type: "destination" as const, label: region.label, region })),
    { id: "daily-life", type: "link" as const, label: "日常生活", href: "/categories/daily-life" },
    { id: "videos", type: "link" as const, label: "影片專區", href: "/videos" },
  ];
  const { data: taxonData, error: taxonError } = await getSupabase().from("content_taxa").select("id,slug,label,kind,parent_id,show_in_nav,sort_order,href").eq("show_in_nav", true).order("sort_order").order("label");
  if (!taxonError && taxonData?.length) {
    const taxa = taxonData as TaxonRow[];
    const roots = taxa.filter((item) => !item.parent_id);
    const legacyRegions = new Map(navigation.map((region) => [region.slug, region]));
    return roots.flatMap<PublicNavbarItem>((root) => {
      if (root.kind === "system") return root.href ? [{ id: root.id, type: "link", label: root.label, href: root.href }] : [];
      const legacyRegion = legacyRegions.get(root.slug as RegionSlug);
      const customChildren = taxa.filter((item) => item.parent_id === root.id).map((child) => ({ id: child.id, label: child.label, href: `/collections/${child.slug}` }));
      const legacyChildren = legacyRegion ? legacyRegion.countries.map((country) => ({ id: `legacy-${country.slug}`, label: country.label, href: `/regions/${legacyRegion.slug}/${country.slug}` })) : [];
      const seen = new Set<string>(); const children = [...legacyChildren, ...customChildren].filter((item) => { const key = item.label.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
      return [{ id: root.id, type: "group", label: root.label, href: legacyRegion ? `/regions/${legacyRegion.slug}` : `/collections/${root.slug}`, children }];
    });
  }
  const { data, error } = await getSupabase().from("navbar_items").select("id,label,item_type,href,destination_region").eq("is_visible", true).order("sort_order").order("created_at");
  if (error || !data?.length) return fallback;
  const regions = new Map(navigation.map((region) => [region.slug, region]));
  return (data as NavbarRow[]).flatMap<PublicNavbarItem>((item) => {
    if (item.item_type === "link" && item.href) return [{ id: item.id, type: "link" as const, label: item.label, href: item.href }];
    const region = item.destination_region ? regions.get(item.destination_region) : null;
    return region ? [{ id: item.id, type: "destination" as const, label: item.label, region }] : [];
  });
}

export function publicMediaUrl(storagePath: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url}/storage/v1/object/public/${storagePath}` : "";
}
