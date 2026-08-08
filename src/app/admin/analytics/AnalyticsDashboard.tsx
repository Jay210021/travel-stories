"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Story = { id: string; title: string; country: string | null };
type View = { story_id: string; viewed_at: string };

export default function AnalyticsDashboard() {
  const [stories, setStories] = useState<Story[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [message, setMessage] = useState(() => process.env.NEXT_PUBLIC_SUPABASE_URL ? "統計載入中…" : "找不到 Supabase 設定。");
  const [sevenDaysAgo] = useState(() => Date.now() - 7 * 86400000);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    Promise.all([
      supabase.from("stories").select("id,title,country").eq("status", "published"),
      supabase.from("story_views").select("story_id,viewed_at").order("viewed_at", { ascending: false }),
    ]).then(([storyResult, viewResult]) => {
      if (storyResult.error || viewResult.error) setMessage(`載入失敗：${storyResult.error?.message ?? viewResult.error?.message}`);
      else { setStories(storyResult.data ?? []); setViews(viewResult.data ?? []); setMessage(""); }
    });
  }, []);

  const popular = useMemo(() => stories.map((story) => ({ ...story, views: views.filter((view) => view.story_id === story.id).length })).sort((a, b) => b.views - a.views).slice(0, 8), [stories, views]);
  const countries = useMemo(() => { const counts = new Map<string, number>(); for (const story of stories) { if (!story.country) continue; const count = views.filter((view) => view.story_id === story.id).length; counts.set(story.country, (counts.get(story.country) ?? 0) + count); } return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [stories, views]);
  const last7Days = views.filter((view) => new Date(view.viewed_at).getTime() >= sevenDaysAgo).length;

  return <main className="min-h-screen bg-[#f5f7f3] px-6 py-8"><nav className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/admin" className="text-sm text-[#c1664b]">← 回作者後台</Link></nav><section className="mx-auto max-w-5xl py-12"><p className="text-sm tracking-[0.2em] text-[#c1664b]">QUIET NUMBERS</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">閱讀統計</h1><p className="mt-4 max-w-xl leading-7 text-[#718078]">只記錄文章瀏覽，不建立訪客檔案，也不保存個人識別資訊。</p><div className="mt-10 grid gap-5 md:grid-cols-3"><Stat label="文章瀏覽" value={String(views.length)} note="所有文章累計" /><Stat label="最近 7 天" value={String(last7Days)} note="近期閱讀次數" /><Stat label="已發布文章" value={String(stories.length)} note="目前公開內容" /></div>{message && <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-[#7a8b83]">{message}</p>}<div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl bg-white p-6"><h2 className="font-semibold text-[#31413d]">熱門文章</h2><div className="mt-5 space-y-3">{popular.map((story, index) => <div key={story.id} className="flex justify-between gap-4 text-sm"><span className="text-[#64776d]">{index + 1}. {story.title}</span><strong className="text-[#c1664b]">{story.views}</strong></div>)}{!popular.length && <p className="text-sm text-[#9aa8a0]">尚無資料</p>}</div></section><section className="rounded-3xl bg-white p-6"><h2 className="font-semibold text-[#31413d]">熱門國家</h2><div className="mt-5 space-y-3">{countries.map(([country, count], index) => <div key={country} className="flex justify-between text-sm"><span className="text-[#64776d]">{index + 1}. {country}</span><strong className="text-[#c1664b]">{count}</strong></div>)}{!countries.length && <p className="text-sm text-[#9aa8a0]">尚無國家資料</p>}</div></section></div></section></main>;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-[#7a8b83]">{label}</p><p className="mt-4 text-4xl font-semibold text-[#31413d]">{value}</p><p className="mt-3 text-xs text-[#9aa8a0]">{note}</p></div>;
}
