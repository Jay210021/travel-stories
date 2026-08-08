import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";

function splitStoragePath(storagePath: string) { const [bucket, ...parts] = storagePath.split("/"); return { bucket, path: parts.join("/") }; }

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) return attach(request, author);
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid media request" }, { status: 400 });
  if (body.action === "reorder" && typeof body.storyId === "string" && Array.isArray(body.mediaIds)) {
    const { error } = await author.supabase.rpc("reorder_story_media", { p_story_id: body.storyId, p_media_ids: body.mediaIds });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (body.action === "update" && typeof body.mediaId === "string") {
    const { error } = await author.supabase.from("story_media").update({ caption: String(body.caption || ""), alt_text: String(body.altText || "") }).eq("id", body.mediaId);
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (body.action === "remove" && typeof body.mediaId === "string") {
    const { data: storagePath, error } = await author.supabase.rpc("detach_story_media", { p_media_id: body.mediaId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const location = splitStoragePath(storagePath);
    const { error: storageError } = await author.supabase.storage.from(location.bucket).remove([location.path]);
    if (storageError) await author.supabase.rpc("queue_media_storage_cleanup", { p_storage_path: storagePath, p_reason: storageError.message });
    return NextResponse.json({ ok: true, cleanupQueued: Boolean(storageError) });
  }
  return NextResponse.json({ error: "Unsupported media action" }, { status: 400 });
}

async function attach(request: Request, author: NonNullable<Awaited<ReturnType<typeof getAuthorContext>>>) {
  const form = await request.formData();
  const storyId = form.get("storyId"); const kind = form.get("kind"); const files = form.getAll("files").filter((value): value is File => value instanceof File);
  const metadata = JSON.parse(String(form.get("metadata") || "[]")) as { caption?: string; altText?: string }[];
  if (typeof storyId !== "string" || (kind !== "photo" && kind !== "video") || !files.length || files.length !== metadata.length) return NextResponse.json({ error: "Invalid media upload" }, { status: 400 });
  const bucket = kind === "photo" ? "travel-photos" : "travel-videos";
  const attached = [];
  for (const [index, file] of files.entries()) {
    const uploadPath = `stories/${storyId}/${crypto.randomUUID()}-${file.name}`;
    const upload = await author.supabase.storage.from(bucket).upload(uploadPath, file, { contentType: file.type });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });
    const storagePath = `${bucket}/${upload.data.path}`;
    const { data, error } = await author.supabase.rpc("attach_story_media", { p_story_id: storyId, p_kind: kind, p_storage_path: storagePath, p_caption: metadata[index].caption || "", p_alt_text: metadata[index].altText || file.name });
    if (error) { await author.supabase.storage.from(bucket).remove([upload.data.path]); return NextResponse.json({ error: error.message }, { status: 400 }); }
    attached.push(data);
  }
  return NextResponse.json({ media: attached });
}
