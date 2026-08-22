import { createHmac } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1024) return Response.json({ error: "Request too large" }, { status: 413 });
  const body = await request.json().catch(() => null) as { storyId?: unknown } | null;
  const storyId = typeof body?.storyId === "string" ? body.storyId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storyId)) return Response.json({ error: "Invalid story" }, { status: 400 });
  const secret = process.env.VIEW_HASH_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "View tracking unavailable" }, { status: 503 });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 300);
  const day = new Date().toISOString().slice(0, 10);
  const viewKey = createHmac("sha256", secret).update(`${day}\n${forwarded}\n${userAgent}`).digest("hex");
  const { data, error } = await getSupabaseServiceClient().rpc("record_story_view", { p_story_id: storyId, p_view_key: viewKey });
  if (error) return Response.json({ error: "Unable to record view" }, { status: 500 });
  return Response.json({ recorded: data === true }, { headers: { "Cache-Control": "no-store" } });
}
