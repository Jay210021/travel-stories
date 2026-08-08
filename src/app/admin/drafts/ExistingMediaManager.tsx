"use client";

/* Stored media URLs are dynamic Supabase assets. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number; caption: string; alt_text: string };

export default function ExistingMediaManager({ storyId }: { storyId: string }) {
  const [items, setItems] = useState<Media[]>([]);
  const [message, setMessage] = useState("媒體載入中…");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.from("story_media").select("id,kind,storage_path,sort_order,caption,alt_text").eq("story_id", storyId).order("sort_order").then(({ data, error }) => {
      setItems((data ?? []) as Media[]); setMessage(error ? `載入失敗：${error.message}` : "");
    });
  }, [storyId]);

  function edit(id: string, changes: Partial<Media>) { setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item)); }

  async function save(item: Media) {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    const { error } = await supabase.from("story_media").update({ caption: item.caption, alt_text: item.alt_text }).eq("id", item.id);
    setMessage(error ? `媒體儲存失敗：${error.message}` : "媒體說明已儲存。");
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= items.length) return;
    const reordered = [...items]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((item, order) => ({ ...item, sort_order: order })); setItems(normalized);
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    const results = await Promise.all(normalized.map((item) => supabase.from("story_media").update({ sort_order: item.sort_order }).eq("id", item.id)));
    setMessage(results.some((result) => result.error) ? "排序儲存失敗。" : "媒體順序已更新。");
    const cover = normalized.find((item) => item.kind === "photo")?.storage_path ?? null;
    await supabase.from("stories").update({ cover_path: cover, updated_at: new Date().toISOString() }).eq("id", storyId);
  }

  async function remove(item: Media) {
    if (!window.confirm("確定移除這個媒體嗎？Storage 檔案也會一併刪除。")) return;
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    const [bucket, ...parts] = item.storage_path.split("/");
    const storageResult = await supabase.storage.from(bucket).remove([parts.join("/")]);
    if (storageResult.error) return setMessage(`檔案刪除失敗：${storageResult.error.message}`);
    const { error } = await supabase.from("story_media").delete().eq("id", item.id);
    if (error) return setMessage(`媒體資料刪除失敗：${error.message}`);
    const remaining = items.filter((current) => current.id !== item.id); setItems(remaining); setMessage("媒體已移除。");
    const cover = remaining.find((current) => current.kind === "photo")?.storage_path ?? null;
    await supabase.from("stories").update({ cover_path: cover, updated_at: new Date().toISOString() }).eq("id", storyId);
  }

  return <section className="mt-8 border-t border-[#e5ebe6] pt-8"><h2 className="font-semibold text-[#31413d]">既有照片與影片</h2>{message && <p className="mt-2 text-sm text-[#7a8b83]">{message}</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2">{items.map((item, index) => { const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${item.storage_path}`; return <div key={item.id} className="rounded-2xl bg-[#f5f7f3] p-3">{item.kind === "video" ? <video src={src} controls className="aspect-video w-full rounded-xl bg-[#31413d]" /> : <img src={src} alt={item.alt_text} className="aspect-[4/3] w-full rounded-xl object-cover" />}<input value={item.caption} onChange={(event) => edit(item.id, { caption: event.target.value })} placeholder="說明" className="mt-3 w-full rounded-lg border bg-white px-3 py-2 text-sm" /><input value={item.alt_text} onChange={(event) => edit(item.id, { alt_text: event.target.value })} placeholder="替代文字／影片標題" className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm" /><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => move(index, -1)} disabled={index === 0} className="rounded-full border px-3 py-1 text-xs disabled:opacity-30">上移</button><button onClick={() => move(index, 1)} disabled={index === items.length - 1} className="rounded-full border px-3 py-1 text-xs disabled:opacity-30">下移</button><button onClick={() => save(item)} className="rounded-full border px-3 py-1 text-xs">儲存說明</button><button onClick={() => remove(item)} className="rounded-full border border-[#9a4d42] px-3 py-1 text-xs text-[#9a4d42]">移除</button></div></div>; })}{!items.length && !message && <p className="text-sm text-[#9aa8a0]">這篇文章尚無媒體。</p>}</div></section>;
}
