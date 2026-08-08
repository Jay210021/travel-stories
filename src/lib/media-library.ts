export type MediaKind = "photo" | "video";

export async function attachMedia(storyId: string, kind: MediaKind, files: File[], metadata: { caption: string; altText: string }[]) {
  const form = new FormData();
  form.set("action", "attach"); form.set("storyId", storyId); form.set("kind", kind); form.set("metadata", JSON.stringify(metadata));
  files.forEach((file) => form.append("files", file));
  return requestMediaLibrary(form);
}

export async function reorderMedia(storyId: string, mediaIds: string[]) { return requestMediaLibrary({ action: "reorder", storyId, mediaIds }); }
export async function removeMedia(mediaId: string) { return requestMediaLibrary({ action: "remove", mediaId }); }
export async function updateMedia(mediaId: string, caption: string, altText: string) { return requestMediaLibrary({ action: "update", mediaId, caption, altText }); }

async function requestMediaLibrary(body: FormData | Record<string, unknown>) {
  const isForm = body instanceof FormData;
  const response = await fetch("/api/media-library", { method: "POST", headers: isForm ? undefined : { "Content-Type": "application/json" }, body: isForm ? body : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "媒體操作失敗。");
  return data;
}
