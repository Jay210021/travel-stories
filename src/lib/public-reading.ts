import { createClient } from "@supabase/supabase-js";
import { destinationNavigation, resolveDestination, type DestinationNavigation, type RegionSlug } from "@/lib/destination";
import type { PublicNavbarItem } from "@/lib/navbar-types";
import { descendantIds } from "@/lib/content-taxonomy-order";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

type StoryRow = { id: string; source_id: string | null; slug: string | null; title: string; body: string; country: string | null; city: string | null; published_at: string | null; cover_path: string | null };
export type PublicStoryCard = Omit<StoryRow, "slug"> & { slug: string; classification_labels: string[] };
export type PublicStory = PublicStoryCard & { media: PublicMedia[] };
export type PublicMedia = { kind: "photo" | "video"; storage_path: string; caption: string; alt_text: string; url: string };
export type PublicVideo = PublicMedia & { story: PublicStoryCard };
export type PublicNavigation = DestinationNavigation;
export type ManagedDestination = { slug: string; label: string; region_slug: RegionSlug; aliases: string[] };
export type PublicTaxon = { id: string; slug: string; label: string; kind: "destination" | "topic"; parent_id: string | null; aliases: string[] };
type NavbarRow = { id: string; label: string; item_type: "link" | "destination"; href: string | null; destination_region: RegionSlug | null };
type TaxonRow = { id: string; slug: string; label: string; kind: "destination" | "topic" | "system"; parent_id: string | null; show_in_nav: boolean; sort_order: number; href: string | null };
type StoryTaxonRow = { story_id: string; taxon_id: string };
type ClassificationTaxonRow = { id: string; label: string; parent_id: string | null };

const storyFields = "id,source_id,slug,title,body,country,city,published_at,cover_path";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public reading configuration is missing.");
  return createClient(url, key);
}

function fallbackClassificationLabels(story: StoryRow) {
  const destination = resolveDestination(story);
  if (destination) return [destination.country?.label ?? destination.region.label];
  return story.country ? [story.country] : [];
}

async function readStoryClassificationLabels(storyIds: string[]) {
  const labels = new Map<string, string[]>();
  if (!storyIds.length) return labels;

  const supabase = getSupabase();
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("story_taxa")
    .select("story_id,taxon_id")
    .in("story_id", storyIds);
  if (assignmentError) throw assignmentError;

  const assignments = (assignmentData ?? []) as StoryTaxonRow[];
  const taxonIds = [...new Set(assignments.map((item) => item.taxon_id))];
  if (!taxonIds.length) return labels;

  const { data: taxonData, error: taxonError } = await supabase
    .from("content_taxa")
    .select("id,label,parent_id")
    .in("id", taxonIds);
  if (taxonError) throw taxonError;

  const taxa = (taxonData ?? []) as ClassificationTaxonRow[];
  const taxonById = new Map(taxa.map((taxon) => [taxon.id, taxon]));
  for (const storyId of storyIds) {
    const assignedIds = assignments.filter((item) => item.story_id === storyId).map((item) => item.taxon_id);
    const parentIds = new Set(assignedIds.map((id) => taxonById.get(id)?.parent_id).filter((id): id is string => Boolean(id)));
    const storyLabels = assignedIds
      .filter((id) => !parentIds.has(id))
      .map((id) => taxonById.get(id)?.label)
      .filter((label): label is string => Boolean(label));
    if (storyLabels.length) labels.set(storyId, [...new Set(storyLabels)]);
  }
  return labels;
}

function normalizeStory(story: StoryRow, classificationLabels?: string[]): PublicStoryCard {
  return {
    ...story,
    slug: story.slug || `story-${story.id.replaceAll("-", "")}`,
    classification_labels: classificationLabels?.length ? classificationLabels : fallbackClassificationLabels(story),
  };
}

async function normalizeStories(stories: StoryRow[]) {
  const labels = await readStoryClassificationLabels(stories.map((story) => story.id));
  return stories.map((story) => normalizeStory(story, labels.get(story.id)));
}

async function readPublishedStoryCards(): Promise<PublicStoryCard[]> {
  const { data, error } = await getSupabase().from("stories").select(storyFields).eq("status", "published").order("published_at", { ascending: false });
  if (error) throw error;
  return normalizeStories((data ?? []) as StoryRow[]);
}

export async function listStoryIndex() {
  return readPublishedStoryCards();
}

export async function getStoryBySlug(slug: string): Promise<PublicStory | null> {
  const { data: story, error } = await getSupabase().from("stories").select(storyFields).eq("status", "published").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!story) return null;
  const [{ data: media, error: mediaError }, classificationLabels] = await Promise.all([
    getSupabase().from("story_media").select("kind,storage_path,caption,alt_text").eq("story_id", story.id).order("sort_order"),
    readStoryClassificationLabels([story.id]),
  ]);
  if (mediaError) throw mediaError;
  const signedMedia = await Promise.all((media ?? []).map(async (item) => ({ ...item, url: await signedMediaUrl(item.storage_path) })));
  return { ...normalizeStory(story as StoryRow, classificationLabels.get(story.id)), media: signedMedia as PublicMedia[] };
}

export async function listStoriesForRegion(region: RegionSlug) {
  const taxon = await getPublicTaxon(region);
  if (taxon) return listStoriesForTaxon(taxon);
  return (await readPublishedStoryCards()).filter((story) => resolveDestination(story)?.region.slug === region);
}

export async function listStoriesForCountry(country: string) {
  const taxon = await getPublicTaxon(country);
  if (taxon) return listStoriesForTaxon(taxon);
  return (await readPublishedStoryCards()).filter((story) => resolveDestination(story)?.country?.slug === country || resolveDestination(story)?.region.slug === country);
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
  return (await readPublishedStoryCards()).filter((story) => assigned.has(story.id) || [story.country ?? "", story.title, story.body].some((value) => aliases.some((alias) => value.toLowerCase().includes(alias))));
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
  const storyRows = (data ?? []).flatMap((media) => {
    const story = Array.isArray(media.stories) ? media.stories[0] : media.stories;
    return story ? [story as StoryRow] : [];
  });
  const classificationLabels = await readStoryClassificationLabels(storyRows.map((story) => story.id));
  const videos = (data ?? []).flatMap((media) => {
    const story = Array.isArray(media.stories) ? media.stories[0] : media.stories;
    return story ? [{ kind: media.kind as PublicMedia["kind"], storage_path: media.storage_path, caption: media.caption, alt_text: media.alt_text, story: normalizeStory(story as StoryRow, classificationLabels.get(story.id)) }] : [];
  });
  return Promise.all(videos.map(async (video) => ({ ...video, url: await signedMediaUrl(video.storage_path) })));
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
    return roots.flatMap<PublicNavbarItem>((root) => {
      if (root.kind === "system") return root.href ? [{ id: root.id, type: "link", label: root.label, href: root.href }] : [];
      const customChildren = taxa.filter((item) => item.parent_id === root.id).map((child) => ({ id: child.id, label: child.label, href: `/collections/${child.slug}` }));
      return [{ id: root.id, type: "group", label: root.label, href: `/collections/${root.slug}`, children: customChildren }];
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

async function signedMediaUrl(storagePath: string) {
  const [bucket, ...parts] = storagePath.split("/");
  if (!bucket || !parts.length || !["travel-photos", "travel-videos"].includes(bucket)) return "";
  const { data, error } = await getSupabaseServiceClient().storage.from(bucket).createSignedUrl(parts.join("/"), 3600);
  if (error) throw error;
  return data.signedUrl;
}
