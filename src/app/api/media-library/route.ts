import { NextResponse } from "next/server";
import { getAuthorContext } from "@/lib/author-access";
import { apiError } from "@/lib/api-error";
import { checkUploadContentLength, MAX_PHOTO_BATCH_BYTES, MAX_VIDEO_BATCH_BYTES, totalFileBytes } from "@/lib/upload-limits";

function splitStoragePath(storagePath: string) { const [bucket, ...parts] = storagePath.split("/"); return { bucket, path: parts.join("/") }; }
const MAX_FILES = 10;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const allowedTypes = {
  photo: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
};

export async function GET(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storyId = new URL(request.url).searchParams.get("storyId");
  if (!storyId) return NextResponse.json({ error: "Invalid story" }, { status: 400 });
  const { data, error } = await author.supabase.from("story_media").select("id,kind,storage_path,sort_order,caption,alt_text").eq("story_id", storyId).order("sort_order");
  if (error) return apiError("list story media", error, "載入媒體失敗，請稍後再試。");
  const media = await Promise.all((data ?? []).map(async (item) => {
    const location = splitStoragePath(item.storage_path);
    const signed = await author.supabase.storage.from(location.bucket).createSignedUrl(location.path, 900);
    return { ...item, url: signed.data?.signedUrl ?? "" };
  }));
  return NextResponse.json({ media });
}

export async function POST(request: Request) {
  const author = await getAuthorContext();
  if (!author) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) return attach(request, author);
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid media request" }, { status: 400 });
  if (body.action === "reorder" && typeof body.storyId === "string" && Array.isArray(body.mediaIds)) {
    const { error } = await author.supabase.rpc("reorder_story_media", { p_story_id: body.storyId, p_media_ids: body.mediaIds });
    return error ? apiError("reorder story media", error, "媒體排序失敗，請稍後再試。") : NextResponse.json({ ok: true });
  }
  if (body.action === "update" && typeof body.mediaId === "string") {
    const { error } = await author.supabase.from("story_media").update({ caption: String(body.caption || ""), alt_text: String(body.altText || "") }).eq("id", body.mediaId);
    return error ? apiError("update story media", error, "更新媒體資料失敗，請稍後再試。") : NextResponse.json({ ok: true });
  }
  if (body.action === "remove" && typeof body.mediaId === "string") {
    const { data: storagePath, error } = await author.supabase.rpc("detach_story_media", { p_media_id: body.mediaId });
    if (error) return apiError("detach story media", error, "移除媒體失敗，請稍後再試。");
    const location = splitStoragePath(storagePath);
    const { error: storageError } = await author.supabase.storage.from(location.bucket).remove([location.path]);
    if (storageError) await author.supabase.rpc("queue_media_storage_cleanup", { p_storage_path: storagePath, p_reason: storageError.message });
    return NextResponse.json({ ok: true, cleanupQueued: Boolean(storageError) });
  }
  return NextResponse.json({ error: "Unsupported media action" }, { status: 400 });
}

async function attach(request: Request, author: NonNullable<Awaited<ReturnType<typeof getAuthorContext>>>) {
  const lengthCheck = checkUploadContentLength(request.headers.get("content-length"));
  if (lengthCheck === "missing") return NextResponse.json({ error: "Content-Length is required" }, { status: 411 });
  if (lengthCheck === "invalid") return NextResponse.json({ error: "Invalid Content-Length" }, { status: 400 });
  if (lengthCheck === "too-large") return NextResponse.json({ error: "Upload is too large" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid upload body" }, { status: 400 });
  const storyId = form.get("storyId"); const kind = form.get("kind"); const files = form.getAll("files").filter((value): value is File => value instanceof File);
  const metadata = (() => { try { return JSON.parse(String(form.get("metadata") || "[]")) as unknown; } catch { return null; } })();
  if (typeof storyId !== "string" || (kind !== "photo" && kind !== "video") || !files.length || files.length > MAX_FILES || !Array.isArray(metadata) || files.length !== metadata.length) return NextResponse.json({ error: "Invalid media upload" }, { status: 400 });
  const maxBytes = kind === "photo" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  const maxBatchBytes = kind === "photo" ? MAX_PHOTO_BATCH_BYTES : MAX_VIDEO_BATCH_BYTES;
  if (totalFileBytes(files) > maxBatchBytes) return NextResponse.json({ error: "Combined upload is too large" }, { status: 413 });
  for (const file of files) {
    if (!allowedTypes[kind].has(file.type) || file.size < 1 || file.size > maxBytes || !await hasValidSignature(file, kind)) return NextResponse.json({ error: `Unsupported or oversized file: ${file.name}` }, { status: 415 });
  }
  const bucket = kind === "photo" ? "travel-photos" : "travel-videos";
  const attached = [];
  for (const [index, file] of files.entries()) {
    const extension = safeExtension(file.type);
    const uploadPath = `stories/${storyId}/${crypto.randomUUID()}.${extension}`;
    const upload = await author.supabase.storage.from(bucket).upload(uploadPath, file, { contentType: file.type });
    if (upload.error) return apiError("upload story media", upload.error, "媒體上傳失敗，請稍後再試。");
    const storagePath = `${bucket}/${upload.data.path}`;
    const item = metadata[index] && typeof metadata[index] === "object" ? metadata[index] as Record<string, unknown> : {};
    const caption = String(item.caption ?? "").slice(0, 500);
    const altText = String(item.altText ?? file.name).slice(0, 300);
    const { data, error } = await author.supabase.rpc("attach_story_media", { p_story_id: storyId, p_kind: kind, p_storage_path: storagePath, p_caption: caption, p_alt_text: altText });
    if (error) { await author.supabase.storage.from(bucket).remove([upload.data.path]); return apiError("attach uploaded story media", error, "媒體連結失敗，請稍後再試。"); }
    attached.push(data);
  }
  return NextResponse.json({ media: attached });
}

function safeExtension(type: string) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as Record<string, string>)[type] ?? "bin";
}

async function hasValidSignature(file: File, kind: "photo" | "video") {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = String.fromCharCode(...bytes);
  if (kind === "photo") {
    return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || text.startsWith("\x89PNG\r\n\x1a\n") || text.startsWith("GIF87a") || text.startsWith("GIF89a")
      || (text.slice(0, 4) === "RIFF" && text.slice(8, 12) === "WEBP");
  }
  return (text.slice(4, 12).includes("ftyp")) || text.startsWith("\x1aE\xdf\xa3");
}
