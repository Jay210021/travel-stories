import { reconcileFacebookImports, retryFacebookEventQueue } from "@/lib/facebook-import-runner";
import { getSupabaseServiceClient } from "@/lib/supabase-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = getSupabaseServiceClient();
    const retriedEvents = await retryFacebookEventQueue();
    const { data: settings } = await supabase.from("facebook_sync_settings").select("state").eq("singleton", true).single();
    const imported = settings?.state === "active" ? await reconcileFacebookImports() : 0;
    await supabase.rpc("purge_expired_facebook_import_attempts");
    return Response.json({ ok: true, imported, retriedEvents, skipped: settings?.state !== "active" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Facebook 補漏失敗" }, { status: 500 });
  }
}
