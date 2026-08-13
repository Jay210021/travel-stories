"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type ArchivedFacebookPost = { draftId: string; publishedAt: string | null; title: string; body: string; media: { path: string }[] };

export default function LegacyFacebookArchiveImport({ posts }: { posts: ArchivedFacebookPost[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => posts.filter((post) => `${post.title} ${post.body}`.toLowerCase().includes(query.toLowerCase())), [posts, query]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((post) => selected.includes(post.draftId));

  async function importSelected() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setMessage("找不到 Supabase 設定。");
    const chosen = posts.filter((post) => selected.includes(post.draftId));
    if (!chosen.length) return;
    setImporting(true); setMessage("正在建立歷史匯入草稿…");
    const { error } = await supabase.from("stories").upsert(chosen.map((post) => ({ source: "facebook", source_id: post.draftId, title: post.title, body: post.body, published_at: post.publishedAt, status: "draft", updated_at: new Date().toISOString() })), { onConflict: "source_id" });
    setImporting(false);
    if (error) setMessage(`歷史匯入失敗：${error.message}`);
    else { setMessage(`已建立或更新 ${chosen.length} 篇歷史 Facebook 草稿。`); setSelected([]); }
  }

  return <section className="bg-[#f5f7f3] px-5 pb-20 sm:px-8"><div className="mx-auto max-w-6xl rounded-3xl border border-[#dce6e0] bg-white p-6 sm:p-8"><details><summary className="cursor-pointer text-xl font-semibold text-[#31413d]">歷史 Facebook 備份匯入</summary><p className="mt-3 text-sm leading-6 text-[#718078]">這是原有的備份檔匯入工具，與啟用後的新貼文自動同步分開運作。</p><div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row"><p className="text-sm text-[#64776d]">共 {posts.length} 篇 · 顯示 {filtered.length} 篇 · 已選 {selected.length} 篇</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋歷史貼文" className="rounded-full border px-4 py-2 text-sm"/></div><div className="mt-4 flex flex-wrap justify-between gap-3"><label className="text-sm text-[#64776d]"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected((current) => allVisibleSelected ? current.filter((id) => !filtered.some((post) => post.draftId === id)) : [...new Set([...current, ...filtered.map((post) => post.draftId)])])} className="mr-2 accent-[#c1664b]"/>選取目前顯示</label><button onClick={importSelected} disabled={!selected.length || importing} className="rounded-full bg-[#c1664b] px-5 py-2 text-sm text-white disabled:opacity-40">{importing ? "匯入中…" : "建立歷史匯入草稿"}</button></div>{message && <p className="mt-4 rounded-xl bg-[#f5f7f3] p-3 text-sm text-[#64776d]">{message}</p>}<div className="mt-5 max-h-[36rem] space-y-3 overflow-y-auto pr-2">{filtered.map((post) => <article key={post.draftId} className={`rounded-2xl border p-4 ${selected.includes(post.draftId) ? "border-[#c1664b] bg-[#fffaf7]" : "border-[#e6ebe8]"}`}><label className="flex gap-3"><input type="checkbox" checked={selected.includes(post.draftId)} onChange={() => setSelected((current) => current.includes(post.draftId) ? current.filter((id) => id !== post.draftId) : [...current, post.draftId])} className="mt-1 accent-[#c1664b]"/><span><strong className="text-sm text-[#31413d]">{post.title}</strong><span className="mt-1 block text-xs text-[#8a9991]">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-TW") : "無日期"} · {post.media.length} 個媒體</span></span></label></article>)}</div></details></div></section>;
}
