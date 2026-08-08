"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ViewTracker({ storyId }: { storyId: string }) {
  useEffect(() => {
    const key = `viewed-story-${storyId}`;
    if (sessionStorage.getItem(key)) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.from("story_views").insert({ story_id: storyId }).then(({ error }) => {
      if (!error) sessionStorage.setItem(key, "1");
    });
  }, [storyId]);
  return null;
}
