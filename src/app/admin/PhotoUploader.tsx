"use client";

/* Preview URLs are local blob URLs; next/image cannot optimize them before upload. */
/* eslint-disable @next/next/no-img-element */

import { DragEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Photo = { id: string; file: File; preview: string; caption: string; alt: string };

export default function PhotoUploader() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState("尚未選擇照片");

  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview)), [photos]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList).filter((file) => file.type.startsWith("image/")).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), caption: "", alt: "" }));
    setPhotos((current) => [...current, ...next]);
    setMessage(next.length ? `已加入 ${next.length} 張照片` : "請選擇圖片檔案");
  }

  function movePhoto(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === draggedId);
      const to = current.findIndex((photo) => photo.id === targetId);
      const result = [...current];
      const [photo] = result.splice(from, 1);
      result.splice(to, 0, photo);
      return result;
    });
    setDraggedId(null);
  }

  function updatePhoto(id: string, field: "caption" | "alt", value: string) {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, [field]: value } : photo));
  }

  async function uploadPhotos() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("展示模式：設定 Supabase 後即可上傳至 Storage"); return; }
    const uploads = await Promise.all(photos.map(async (photo) => supabase.storage.from("travel-photos").upload(`drafts/${crypto.randomUUID()}-${photo.file.name}`, photo.file)));
    setMessage(uploads.every(({ error }) => !error) ? "照片已上傳至 Storage" : "部分照片上傳失敗，請再試一次");
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(event.dataTransfer.files); }

  return <section className="mt-8 rounded-3xl bg-[#f5f7f3] p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-[#31413d]">照片圖庫</h2><p className="mt-1 text-sm text-[#7a8b83]">第一張照片會作為封面，可拖曳調整順序。</p></div><label className="cursor-pointer rounded-full bg-[#e5eee7] px-4 py-2 text-sm text-[#557166] hover:bg-[#d8e8dc]">選擇照片<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} /></label></div><div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="mt-5 rounded-2xl border-2 border-dashed border-[#cbd9d1] p-4"><div className="grid gap-4 sm:grid-cols-2">{photos.map((photo, index) => <div key={photo.id} draggable onDragStart={() => setDraggedId(photo.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); movePhoto(photo.id); }} className="rounded-2xl bg-white p-3 shadow-sm"><div className="relative aspect-[4/3] overflow-hidden rounded-xl"><img src={photo.preview} alt={photo.alt || "預覽照片"} className="h-full w-full object-cover" /><span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-1 text-xs text-[#557166]">{index === 0 ? "封面" : `第 ${index + 1} 張`}</span></div><input value={photo.caption} onChange={(event) => updatePhoto(photo.id, "caption", event.target.value)} placeholder="照片說明" className="mt-3 w-full rounded-lg border border-[#dce5de] px-3 py-2 text-sm outline-none focus:border-[#c1664b]" /><input value={photo.alt} onChange={(event) => updatePhoto(photo.id, "alt", event.target.value)} placeholder="替代文字（無障礙）" className="mt-2 w-full rounded-lg border border-[#dce5de] px-3 py-2 text-sm outline-none focus:border-[#c1664b]" /></div>)}{photos.length === 0 && <p className="col-span-full py-8 text-center text-sm text-[#9aa8a0]">將照片拖曳到這裡，或點擊上方按鈕選擇照片</p>}</div></div><div className="mt-4 flex items-center justify-between gap-4"><span className="text-xs text-[#7a8b83]">{message}</span><button onClick={uploadPhotos} disabled={!photos.length} className="rounded-full bg-[#c1664b] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">上傳照片</button></div></section>;
}
