import { createClient } from "@supabase/supabase-js";

export type PublishedStory = { id: string; source_id: string | null; slug: string; title: string; body: string; category: string; country: string | null; city: string | null; published_at: string | null; cover_path: string | null; media: { kind: string; storage_path: string; caption: string; alt_text: string }[] };

export async function getPublishedStories() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [] as PublishedStory[];
  const supabase = createClient(url, key);
  const { data } = await supabase.from("stories").select("id,source_id,slug,title,body,category,country,city,published_at,cover_path").eq("status", "published").order("published_at", { ascending: false });
  const stories = (data ?? []).map((story) => ({ ...story, slug: story.slug || `story-${story.id.replaceAll("-", "")}` }));
  if (!stories.length) return [];
  const { data: media } = await supabase.from("story_media").select("story_id,kind,storage_path,caption,alt_text,sort_order").in("story_id", stories.map((story) => story.id)).order("sort_order");
  return stories.map((story) => ({ ...story, media: (media ?? []).filter((item) => item.story_id === story.id) })) as PublishedStory[];
}
