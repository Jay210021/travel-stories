import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";
import { apiError } from "@/lib/api-error";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await author.supabase.from("managed_destinations").select("id,slug,label,region_slug,aliases,is_visible").order("label");
  return error ? apiError("list managed destinations", error) : NextResponse.json({ destinations: data ?? [] });
}

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { label?: unknown; slug?: unknown; region?: unknown; aliases?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const slug = slugify(typeof body?.slug === "string" && body.slug ? body.slug : label) || `destination-${crypto.randomUUID().slice(0, 8)}`;
  const region = typeof body?.region === "string" ? body.region : "";
  const aliases = typeof body?.aliases === "string" ? body.aliases.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean) : [];
  if (!label || !slug || !["europe", "asia", "africa", "taiwan"].includes(region)) return NextResponse.json({ error: "請填寫目的地名稱與所屬洲別。" }, { status: 400 });
  const { data, error } = await author.supabase.from("managed_destinations").insert({ label, slug, region_slug: region, aliases: [...new Set([label, ...aliases])] }).select("id,slug,label,region_slug,aliases,is_visible").single();
  return error ? apiError("create managed destination", error, "新增目的地失敗，請稍後再試。") : NextResponse.json({ destination: data });
}
