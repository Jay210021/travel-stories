import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";

const actions = new Set(["publish", "unpublish", "trash", "restore"]);

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !actions.has(body.action) || !Array.isArray(body.storyIds) || !body.storyIds.length || !body.storyIds.every((id: unknown) => typeof id === "string")) {
    return NextResponse.json({ error: "Invalid workflow request" }, { status: 400 });
  }
  const { data, error } = await author.supabase.rpc("apply_story_workflow", { workflow_action: body.action, story_ids: body.storyIds });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ stories: data ?? [] });
}
