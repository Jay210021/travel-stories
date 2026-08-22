"use client";

import { useEffect } from "react";

export default function ViewTracker({ storyId }: { storyId: string }) {
  useEffect(() => {
    const key = `viewed-story-${storyId}`;
    if (sessionStorage.getItem(key)) return;
    fetch("/api/story-view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) }).then((response) => {
      if (response.ok) sessionStorage.setItem(key, "1");
    }).catch(() => undefined);
  }, [storyId]);
  return null;
}
