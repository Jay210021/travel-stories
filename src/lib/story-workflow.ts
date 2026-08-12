export type StoryWorkflowAction = "publish" | "unpublish" | "trash" | "restore";
export type WorkflowStory = { id: string; status: "draft" | "published" | "trash"; published_at: string | null; deleted_at: string | null; slug: string | null };

export async function runStoryWorkflow(action: StoryWorkflowAction, storyIds: string[]) {
  const response = await fetch("/api/story-workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, storyIds }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = [data.error, data.details, data.hint, data.code ? `錯誤代碼：${data.code}` : ""].filter(Boolean).join("\n");
    throw new Error(reason || "文章狀態變更失敗。");
  }
  return data.stories as WorkflowStory[];
}
