import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";
import { apiError } from "@/lib/api-error";

type EditableInput = { label?: unknown; kind?: unknown; parentId?: unknown; aliases?: unknown; showInNav?: unknown };
const editableKinds = new Set(["destination", "topic"]);
const fields = "id,slug,label,kind,parent_id,aliases,show_in_nav,sort_order,href";

function baseSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-").replace(/^-|-$/g, "") || `item-${crypto.randomUUID().slice(0, 8)}`; }
function aliasesFrom(value: unknown, label: string) { const values = typeof value === "string" ? value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean) : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; return [...new Set([label, ...values])]; }

async function validatedParent(author: NonNullable<Awaited<ReturnType<typeof getAuthorContext>>>, parentId: unknown) {
  if (parentId === null || parentId === undefined || parentId === "") return { parent: null, error: null };
  if (typeof parentId !== "string") return { parent: null, error: "上層分類格式不正確。" };
  const { data, error } = await author.supabase.from("content_taxa").select("id,kind,parent_id").eq("id", parentId).maybeSingle();
  if (error || !data || data.parent_id || data.kind === "system") return { parent: null, error: "上層必須是目的地或主題的主分類。" };
  return { parent: data, error: null };
}

async function nextOrder(author: NonNullable<Awaited<ReturnType<typeof getAuthorContext>>>, parentId: string | null) {
  let query = author.supabase.from("content_taxa").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data, error } = await query.maybeSingle();
  return { value: Math.min((data?.sort_order ?? 0) + 10, 2_147_483_647), error };
}

export async function GET() {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await author.supabase.from("content_taxa").select(fields).order("sort_order").order("label");
  return error ? apiError("list content classifications", error) : NextResponse.json({ taxa: data ?? [] });
}

export async function POST(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as EditableInput | null;
  const label = typeof body?.label === "string" ? body.label.trim() : ""; const kind = String(body?.kind ?? "");
  if (!label || label.length > 60 || !editableKinds.has(kind)) return NextResponse.json({ error: "請填寫名稱與分類類型。" }, { status: 400 });
  const parentResult = await validatedParent(author, body?.parentId); if (parentResult.error) return NextResponse.json({ error: parentResult.error }, { status: 400 });
  const parentId = parentResult.parent?.id ?? null; const order = await nextOrder(author, parentId); if (order.error) return apiError("read classification sort order", order.error);
  let slug = baseSlug(label); const { data: duplicateSlug } = await author.supabase.from("content_taxa").select("id").eq("slug", slug).maybeSingle(); if (duplicateSlug) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await author.supabase.from("content_taxa").insert({ label, slug, kind, parent_id: parentId, aliases: aliasesFrom(body?.aliases, label), show_in_nav: body?.showInNav === true, sort_order: order.value }).select(fields).single();
  if (error?.code === "23505") return NextResponse.json({ error: "同一層已經有相同名稱的分類。" }, { status: 400 });
  return error ? apiError("create content classification", error, "新增分類失敗，請稍後再試。") : NextResponse.json({ taxon: data });
}

export async function PATCH(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as ({ id?: unknown } & EditableInput) | null;
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  const { data: current, error: currentError } = await author.supabase.from("content_taxa").select(fields).eq("id", body.id).maybeSingle();
  if (currentError) return apiError("load content classification", currentError);
  if (!current) return NextResponse.json({ error: "找不到分類。" }, { status: 404 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.showInNav === "boolean") update.show_in_nav = body.showInNav;
  if (current.kind !== "system") {
    const label = typeof body.label === "string" ? body.label.trim() : current.label; const kind = editableKinds.has(String(body.kind)) ? String(body.kind) : current.kind;
    if (!label || label.length > 60) return NextResponse.json({ error: "分類名稱不正確。" }, { status: 400 });
    const parentResult = await validatedParent(author, body.parentId === undefined ? current.parent_id : body.parentId); if (parentResult.error || parentResult.parent?.id === current.id) return NextResponse.json({ error: parentResult.error || "分類不能成為自己的上層。" }, { status: 400 });
    if (kind !== current.kind || (parentResult.parent?.id ?? null) !== current.parent_id) { const { count } = await author.supabase.from("content_taxa").select("id", { count: "exact", head: true }).eq("parent_id", current.id); if ((count ?? 0) > 0) return NextResponse.json({ error: "此分類仍有子分類，請先移動或刪除子分類。" }, { status: 400 }); }
    update.label = label; update.kind = kind; update.parent_id = parentResult.parent?.id ?? null; update.aliases = aliasesFrom(body.aliases === undefined ? current.aliases : body.aliases, label);
    if (update.parent_id !== current.parent_id) { const order = await nextOrder(author, update.parent_id as string | null); if (order.error) return apiError("read classification sort order", order.error); update.sort_order = order.value; }
  }
  const { data, error } = await author.supabase.from("content_taxa").update(update).eq("id", body.id).select(fields).single();
  if (error?.code === "23505") return NextResponse.json({ error: "同一層已經有相同名稱的分類。" }, { status: 400 });
  return error ? apiError("update content classification", error, "更新分類失敗，請稍後再試。") : NextResponse.json({ taxon: data });
}

export async function PUT(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { parentId?: unknown; ids?: unknown } | null;
  if (!Array.isArray(body?.ids) || !body.ids.every((id) => typeof id === "string") || !(body.parentId === null || typeof body.parentId === "string")) return NextResponse.json({ error: "排序資料不正確。" }, { status: 400 });
  const { error } = await author.supabase.rpc("reorder_content_taxa", { p_parent_id: body.parentId, p_taxon_ids: body.ids });
  return error ? apiError("reorder content classifications", error, "分類排序失敗，請稍後再試。") : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const author = await getAuthorContext(); if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  const { data: item } = await author.supabase.from("content_taxa").select("kind").eq("id", id).maybeSingle(); if (item?.kind === "system") return NextResponse.json({ error: "系統頁面可以隱藏，但不能刪除。" }, { status: 400 });
  const { error } = await author.supabase.from("content_taxa").delete().eq("id", id);
  return error ? apiError("delete content classification", error, "刪除分類失敗，請稍後再試。") : NextResponse.json({ ok: true });
}
