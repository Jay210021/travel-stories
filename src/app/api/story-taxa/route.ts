import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";

export async function GET(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storyId = new URL(request.url).searchParams.get("storyId"); if (!storyId) return NextResponse.json({ error: "Missing story" }, { status: 400 });
  const [{ data: taxa, error }, { data: assignments }] = await Promise.all([author.supabase.from("content_taxa").select("id,label,kind,parent_id").order("sort_order").order("label"), author.supabase.from("story_taxa").select("taxon_id").eq("story_id", storyId)]);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ taxa: taxa ?? [], selected: (assignments ?? []).map((item) => item.taxon_id) });
}
export async function PUT(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { storyId?: unknown; taxonIds?: unknown } | null;
  if (typeof body?.storyId !== "string" || !Array.isArray(body.taxonIds) || !body.taxonIds.every((id) => typeof id === "string")) return NextResponse.json({ error: "Invalid classification selection" }, { status: 400 });
  const { error } = await author.supabase.rpc("set_story_taxa", { p_story_id: body.storyId, p_taxon_ids: body.taxonIds });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
