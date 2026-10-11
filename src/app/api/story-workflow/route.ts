import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";
import { apiError } from "@/lib/api-error";

const actions = new Set(["publish", "unpublish", "trash", "restore"]);

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !actions.has(body.action) || !Array.isArray(body.storyIds) || !body.storyIds.length || !body.storyIds.every((id: unknown) => typeof id === "string")) {
    return NextResponse.json({ error: "Invalid workflow request" }, { status: 400 });
  }
  if (body.action === "publish") {
    const [stories, classifications] = await Promise.all([
      author.supabase.from("stories").select("id,title,source_id,title_confirmed").in("id", body.storyIds),
      author.supabase.from("story_taxa").select("story_id").in("story_id", body.storyIds),
    ]);
    const validationError = stories.error || classifications.error;
    if (validationError) return apiError("check story publish readiness", validationError, "無法確認文章標題與分類，請稍後再試。");
    const classifiedIds = new Set((classifications.data ?? []).map((row) => row.story_id));
    const unready = (stories.data ?? []).filter((story) => story.source_id?.startsWith("facebook-live:") && (!story.title_confirmed || !classifiedIds.has(story.id)));
    if (unready.length) return NextResponse.json({
      error: "以下 Facebook 草稿尚未確認標題或分類：",
      details: `${unready.map((story) => `「${story.title}」`).join("\n")}\n\n請逐篇開啟這些文章，確認標題與分類並按「儲存」，再勾選發布。`,
    }, { status: 422 });
  }
  const { data, error } = await author.supabase.rpc("apply_story_workflow", { workflow_action: body.action, story_ids: body.storyIds });
  if (error) return apiError("apply story workflow", error, "文章狀態變更失敗，請稍後再試。");
  return NextResponse.json({ stories: data ?? [] });
}
