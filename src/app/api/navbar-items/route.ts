import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";

type ItemInput = { label?: unknown; type?: unknown; href?: unknown; destinationRegion?: unknown; sortOrder?: unknown; isVisible?: unknown };
const regions = new Set(["europe", "asia", "africa", "taiwan"]);

function normalize(input: ItemInput) {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const itemType = input.type === "link" || input.type === "destination" ? input.type : null;
  const href = typeof input.href === "string" ? input.href.trim() : "";
  const destinationRegion = typeof input.destinationRegion === "string" ? input.destinationRegion : "";
  if (!label || label.length > 40 || !itemType) return null;
  if (itemType === "link" && (!href || (!href.startsWith("/") && !/^https?:\/\//.test(href)))) return null;
  if (itemType === "destination" && !regions.has(destinationRegion)) return null;
  return {
    label,
    item_type: itemType,
    href: itemType === "link" ? href : null,
    destination_region: itemType === "destination" ? destinationRegion : null,
    ...(typeof input.sortOrder === "number" ? { sort_order: input.sortOrder } : {}),
    ...(typeof input.isVisible === "boolean" ? { is_visible: input.isVisible } : {}),
  };
}

export async function GET() {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await author.supabase.from("navbar_items").select("id,label,item_type,href,destination_region,sort_order,is_visible").order("sort_order").order("created_at");
  if (error?.message.includes("Could not find the table") || error?.code === "42P01") {
    return NextResponse.json({ error: "Navbar 資料表尚未建立，請先在 Supabase 執行 008_navbar_items.sql。", migrationRequired: true }, { status: 409 });
  }
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const value = normalize((await request.json().catch(() => null)) ?? {});
  if (!value) return NextResponse.json({ error: "請填寫有效的名稱與連結／地區。" }, { status: 400 });
  const { data: lastItem, error: orderError } = await author.supabase.from("navbar_items").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 400 });
  const nextSortOrder = typeof value.sort_order === "number" ? value.sort_order : Math.min((lastItem?.sort_order ?? 0) + 10, 2_147_483_647);
  const { data, error } = await author.supabase.from("navbar_items").insert({ ...value, sort_order: nextSortOrder }).select("id,label,item_type,href,destination_region,sort_order,is_visible").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ item: data });
}

export async function PATCH(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; item?: ItemInput } | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Invalid navigation item" }, { status: 400 });
  const value = normalize(body.item ?? {});
  if (!value) return NextResponse.json({ error: "請填寫有效的名稱與連結／地區。" }, { status: 400 });
  const { data, error } = await author.supabase.from("navbar_items").update(value).eq("id", body.id).select("id,label,item_type,href,destination_region,sort_order,is_visible").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Invalid navigation item" }, { status: 400 });
  const { error } = await author.supabase.from("navbar_items").delete().eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
