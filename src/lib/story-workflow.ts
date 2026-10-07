export type StoryWorkflowAction = "publish" | "unpublish" | "trash" | "restore";
export type WorkflowStory = { id: string; status: "draft" | "published" | "trash"; published_at: string | null; deleted_at: string | null; slug: string | null };

export async function runStoryWorkflow(action: StoryWorkflowAction, storyIds: string[]) {
  const response = await fetch("/api/story-workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, storyIds }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = [data.error, data.details, data.hint, data.code ? `錯誤代碼：${data.code}` : ""].filter(Boolean).join("\n");
    throw new Error(reason || "文章狀態變更失敗。");
  }
  const stories: unknown = data?.stories;
  const expectedStatus = action === "publish" ? "published" : action === "trash" ? "trash" : "draft";
  const requestedIds = new Set(storyIds);
  if (!storyIds.length || !Array.isArray(stories) || stories.length !== requestedIds.size
    || !stories.every((story) => story && typeof story.id === "string" && requestedIds.has(story.id) && story.status === expectedStatus)
    || new Set(stories.map((story) => story.id)).size !== requestedIds.size) {
    throw new Error("未能確認所有文章的狀態已更新，請重新整理後再試。");
  }
  return stories as WorkflowStory[];
}
