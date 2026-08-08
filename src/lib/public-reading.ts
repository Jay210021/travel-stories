import { createClient } from "@supabase/supabase-js";
import { destinationNavigation, resolveDestination, type DestinationNavigation, type RegionSlug } from "@/lib/destination";

type StoryRow = { id: string; source_id: string | null; slug: string | null; title: string; body: string; category: string; country: string | null; city: string | null; published_at: string | null; cover_path: string | null };
export type PublicStoryCard = Omit<StoryRow, "slug"> & { slug: string };
export type PublicStory = PublicStoryCard & { media: PublicMedia[] };
export type PublicMedia = { kind: "photo" | "video"; storage_path: string; caption: string; alt_text: string };
export type PublicVideo = PublicMedia & { story: PublicStoryCard };
export type PublicNavigation = DestinationNavigation;

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

export function publicMediaUrl(storagePath: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url}/storage/v1/object/public/${storagePath}` : "";
}
