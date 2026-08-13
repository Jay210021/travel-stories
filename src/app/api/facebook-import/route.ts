import { getAuthorContext } from "@/lib/author-access";
import { getFacebookPage } from "@/lib/facebook-graph";
import { applyLatestFacebookImport, importFacebookPostById, reconcileFacebookImports, retryFacebookImport } from "@/lib/facebook-import-runner";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const author = await getAuthorContext();
  if (!author) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [settings, imports, attempts] = await Promise.all([
    author.supabase.from("facebook_sync_settings").select("*").eq("singleton", true).single(),
    author.supabase.from("facebook_imports").select("id,page_id,post_id,story_id,status,source_permalink,source_created_at,source_updated_at,attention_reason,attempt_count,suggested_taxon_id,possible_duplicate_story_id,updated_at").order("updated_at", { ascending: false }).range(0, 999),
    author.supabase.from("facebook_import_attempts").select("id,page_id,post_id,attempt_number,outcome,stage,error_code,error_reason,started_at,finished_at").order("created_at", { ascending: false }).range(0, 999),
  ]);
  const error = settings.error || imports.error || attempts.error;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  const { data: stories, error: storiesError } = await author.supabase.from("stories").select("id,title,status").neq("status", "trash").order("updated_at", { ascending: false }).limit(300);
  return storiesError ? Response.json({ error: storiesError.message }, { status: 400 }) : Response.json({ settings: settings.data, imports: imports.data || [], attempts: attempts.data || [], stories: stories || [] });
}

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; postId?: string; importId?: string; storyId?: string } | null;
  try {
    if (body?.action === "test" && body.postId) {
      const page = await getFacebookPage();
      const result = await importFacebookPostById(body.postId);
      await getSupabaseServiceClient().from("facebook_sync_settings").update({ page_id: page.id, state: "testing", last_error: null, updated_at: new Date().toISOString() }).eq("singleton", true);
      return Response.json({ ok: true, page, result });
    }
    if (body?.action === "activate") {
      const page = await getFacebookPage();
      const { data: settings } = await getSupabaseServiceClient().from("facebook_sync_settings").select("state").eq("singleton", true).single();
      if (settings?.state !== "testing") return Response.json({ error: "請先成功建立並檢查測試草稿，再啟用自動匯入。" }, { status: 400 });
      const { error } = await getSupabaseServiceClient().from("facebook_sync_settings").update({ page_id: page.id, state: "active", activated_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("singleton", true);
      if (error) throw error;
      return Response.json({ ok: true, page });
    }
    if (body?.action === "check") return Response.json({ ok: true, imported: await reconcileFacebookImports() });
    if (body?.action === "retry" && body.postId) return Response.json({ ok: true, result: await retryFacebookImport(body.postId) });
    if (body?.action === "apply_latest" && body.postId) return Response.json({ ok: true, result: await applyLatestFacebookImport(body.postId) });
    if (body?.action === "link_existing" && body.importId && body.storyId) {
      const { error } = await author.supabase.rpc("link_facebook_import_to_story", { p_import_id: body.importId, p_story_id: body.storyId });
      if (error) throw error;
      return Response.json({ ok: true });
    }
    return Response.json({ error: "不支援的 Facebook 匯入操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Facebook 匯入操作失敗" }, { status: 400 });
  }
}
