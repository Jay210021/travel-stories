"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ImportedPost = { draftId: string; publishedAt: string | null; title: string; body: string; category: string; country: string | null; city: string | null; media: { path: string }[] };

export default function FacebookImportPreview({ posts }: { posts: ImportedPost[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => posts.filter((post) => `${post.title} ${post.body}`.toLowerCase().includes(query.toLowerCase())), [posts, query]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((post) => selected.includes(post.draftId));
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleVisible() { setSelected((current) => allVisibleSelected ? current.filter((id) => !filtered.some((post) => post.draftId === id)) : [...new Set([...current, ...filtered.map((post) => post.draftId)])]); }

  async function importSelected() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setMessage("找不到 Supabase 設定。");
    const chosen = posts.filter((post) => selected.includes(post.draftId));
    if (!chosen.length) return;
    setImporting(true); setMessage("正在建立匯入草稿…");
    const { error } = await supabase.from("stories").upsert(chosen.map((post) => ({ source: "facebook", source_id: post.draftId, title: post.title, body: post.body, category: post.category, country: post.country, city: post.city, published_at: post.publishedAt, status: "draft", updated_at: new Date().toISOString() })), { onConflict: "source_id" });
    setImporting(false);
    if (error) setMessage(`匯入失敗：${error.message}`);
    else { setMessage(`已建立或更新 ${chosen.length} 篇 Facebook 草稿。媒體可再使用匯入工具批次上傳。`); setSelected([]); }
  }

  return <main className="min-h-screen bg-[#f5f7f3] px-6 py-8"><nav className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/admin" className="text-sm text-[#c1664b]">← 回作者後台</Link></nav><section className="mx-auto max-w-6xl py-12"><p className="text-sm tracking-[0.2em] text-[#c1664b]">FACEBOOK ARCHIVE</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">匯入預覽</h1><p className="mt-4 max-w-2xl leading-7 text-[#718078]">挑選文章後建立 Supabase 草稿；相同 Facebook 編號會更新既有草稿，不會重複新增。</p><div className="mt-8 flex flex-col justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center"><div className="flex flex-wrap gap-5 text-sm text-[#64776d]"><span>共 {posts.length} 篇</span><span>目前顯示 {filtered.length} 篇</span><span>已選 {selected.length} 篇</span></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋貼文內容" className="rounded-full border border-[#d3dfd8] px-4 py-2 text-sm outline-none focus:border-[#c1664b]" /></div><div className="mt-5 flex flex-wrap items-center justify-between gap-4"><label className="flex items-center gap-2 text-sm text-[#64776d]"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="accent-[#c1664b]" />選取目前顯示的文章</label><button onClick={importSelected} disabled={!selected.length || importing} className="rounded-full bg-[#c1664b] px-5 py-2 text-sm text-white disabled:opacity-40">{importing ? "匯入中…" : "建立匯入草稿"}</button></div>{message && <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-[#648276]">{message}</p>}<div className="mt-5 space-y-4">{filtered.map((post) => <article key={post.draftId} className={`rounded-3xl bg-white p-5 shadow-sm transition ${selected.includes(post.draftId) ? "ring-2 ring-[#c1664b]" : ""}`}><div className="flex gap-4"><input type="checkbox" checked={selected.includes(post.draftId)} onChange={() => toggle(post.draftId)} className="mt-1 h-4 w-4 accent-[#c1664b]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs tracking-[0.12em] text-[#c1664b]">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("zh-TW") : "無日期"} · {post.draftId}</p><span className="text-xs text-[#7a8b83]">{post.media.length} 個媒體 · {post.category}</span></div><h2 className="mt-2 font-semibold text-[#31413d]">{post.title}</h2><p className="mt-3 max-h-28 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-[#718078]">{post.body || "（此貼文沒有可解析的文字。）"}</p></div></div></article>)}{filtered.length === 0 && <p className="rounded-3xl bg-white p-10 text-center text-[#7a8b83]">找不到符合的貼文。</p>}</div></section></main>;
}
