import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";

export async function GET(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storyId = new URL(request.url).searchParams.get("storyId");
  const assignmentsQuery = storyId ? author.supabase.from("story_taxa").select("taxon_id").eq("story_id", storyId) : Promise.resolve({ data: [] });
  const suggestionQuery = storyId ? author.supabase.from("facebook_imports").select("suggested_taxon_id").eq("story_id", storyId).maybeSingle() : Promise.resolve({ data: null });
  const [{ data: taxa, error }, { data: assignments }, { data: suggestion }] = await Promise.all([author.supabase.from("content_taxa").select("id,label,kind,parent_id").eq("show_in_nav", true).order("sort_order").order("label"), assignmentsQuery, suggestionQuery]);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ taxa: taxa ?? [], selected: (assignments ?? []).map((item) => item.taxon_id), suggested: suggestion?.suggested_taxon_id ?? null });
}
export async function PUT(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { storyId?: unknown; taxonIds?: unknown } | null;
  if (typeof body?.storyId !== "string" || !Array.isArray(body.taxonIds) || body.taxonIds.length !== 1 || !body.taxonIds.every((id) => typeof id === "string")) return NextResponse.json({ error: "請選擇一個有效的文章分類。" }, { status: 400 });
  const taxonId = body.taxonIds[0] as string;
  const { data: taxon, error: taxonError } = await author.supabase.from("content_taxa").select("id,kind,parent_id,show_in_nav").eq("id", taxonId).maybeSingle();
  if (taxonError || !taxon || taxon.kind === "system" || !taxon.show_in_nav) return NextResponse.json({ error: "所選分類不在目前 Navbar 中。" }, { status: 400 });
  if (!taxon.parent_id) {
    const { count } = await author.supabase.from("content_taxa").select("id", { count: "exact", head: true }).eq("parent_id", taxon.id).eq("show_in_nav", true);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "請繼續選擇子分類。" }, { status: 400 });
  }
  const { error } = await author.supabase.rpc("set_story_taxa", { p_story_id: body.storyId, p_taxon_ids: body.taxonIds });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
