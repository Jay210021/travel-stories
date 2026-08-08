"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { runStoryWorkflow, type StoryWorkflowAction } from "@/lib/story-workflow";
import ExistingMediaManager from "./ExistingMediaManager";

type Draft = { id?: string; draftId: string; source?: string; status: string; title: string; body: string; publishedAt: string | null; category: string; country: string | null; city: string | null; attraction?: string | null; journeySeries?: string | null; deletedAt?: string | null; media: { path: string; order: number; isCover: boolean; caption: string; alt: string }[]; review: { needsLocation: boolean; needsPrivacyCheck: boolean; readyToPublish: boolean } };
type StoryRow = { id: string; source: string; source_id: string; status: string; title: string; body: string; category: string; country: string | null; city: string | null; attraction: string | null; journey_series: string | null; published_at: string | null; deleted_at: string | null };
const cats = ["國外旅行", "台灣旅行", "日常生活"];
const emptyReview = { needsLocation: false, needsPrivacyCheck: false, readyToPublish: false };

export default function DraftManager({ initialDrafts }: { initialDrafts: Draft[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState(initialDrafts[0]?.draftId ?? "");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("全部");
  const [status, setStatus] = useState("全部");
  const [message, setMessage] = useState("正在同步 Supabase…");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    supabase.from("stories").select("id,source,source_id,status,title,body,category,country,city,attraction,journey_series,published_at,deleted_at").order("updated_at", { ascending: false }).then(({ data, error }) => {
      if (error) return setMessage(`同步失敗：${error.message}`);
      const rows = (data ?? []) as StoryRow[];
      setDrafts((local) => rows.map((row) => {
        const fallback = local.find((draft) => draft.draftId === row.source_id);
        return { id: row.id, draftId: row.source_id, source: row.source, status: row.status, title: row.title, body: row.body, publishedAt: row.published_at ?? fallback?.publishedAt ?? null, category: row.category, country: row.country, city: row.city, attraction: row.attraction, journeySeries: row.journey_series, deletedAt: row.deleted_at, media: fallback?.media ?? [], review: fallback?.review ?? emptyReview };
      }));
      setActiveId((current) => rows.some((row) => row.source_id === current) ? current : rows[0]?.source_id ?? "");
      setMessage("");
    });
  }, []);

  const list = useMemo(() => drafts.filter((draft) => (cat === "全部" || draft.category === cat) && (status === "全部" || draft.status === status) && `${draft.title} ${draft.body} ${draft.country ?? ""} ${draft.city ?? ""} ${draft.attraction ?? ""}`.toLowerCase().includes(query.toLowerCase())), [drafts, cat, status, query]);
  const active = drafts.find((draft) => draft.draftId === activeId) ?? list[0];
  const edit = (changes: Partial<Draft>) => active && setDrafts((items) => items.map((draft) => draft.draftId === active.draftId ? { ...draft, ...changes } : draft));

  async function saveStory() {
    if (!active) return;
    const supabase = getSupabaseBrowserClient(); if (!supabase) return setMessage("找不到 Supabase 設定。");
    const { error } = await supabase.from("stories").update({ title: active.title, body: active.body, category: active.category, country: active.country, city: active.city, attraction: active.attraction || null, journey_series: active.journeySeries || null, published_at: active.publishedAt, updated_at: new Date().toISOString() }).eq("source_id", active.draftId);
    setMessage(error ? `儲存失敗：${error.message}` : "文章內容已儲存。");
  }

  async function applyWorkflow(action: StoryWorkflowAction, targets: Draft[]) {
    const storyIds = targets.flatMap((draft) => draft.id ? [draft.id] : []);
    if (storyIds.length !== targets.length) { setMessage("部分文章尚未同步到 Supabase，請重新整理後再試。 "); return false; }
    try {
      const result = await runStoryWorkflow(action, storyIds);
      const updates = new Map(result.map((story) => [story.id, story]));
      setDrafts((items) => items.map((draft) => {
        const update = draft.id ? updates.get(draft.id) : undefined;
        return update ? { ...draft, status: update.status, publishedAt: update.published_at, deletedAt: update.deleted_at } : draft;
      }));
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文章狀態更新失敗。");
      return false;
    }
  }

  async function publish(ids: string[]) {
    if (!ids.length) return setMessage("請先選擇文章。");
    const targets = drafts.filter((draft) => ids.includes(draft.draftId) && draft.status !== "trash");
    if (!targets.length) return setMessage("垃圾桶文章需先復原才能發布。");
    if (!window.confirm(`確定發布選取的 ${targets.length} 篇文章嗎？`)) return;
    if (await applyWorkflow("publish", targets)) { setSelected([]); setMessage(`已發布 ${targets.length} 篇文章。`); }
  }

  async function unpublishSelected() {
    const ids = drafts.filter((draft) => selected.includes(draft.draftId) && draft.status === "published").map((draft) => draft.draftId);
    if (!ids.length) return setMessage("選取的文章中沒有已發布文章。");
    if (!window.confirm(`確定取消發布選取的 ${ids.length} 篇文章嗎？`)) return;
    const targets = drafts.filter((draft) => ids.includes(draft.draftId));
    if (await applyWorkflow("unpublish", targets)) { setSelected([]); setMessage(`已取消發布 ${ids.length} 篇文章。`); }
  }

  async function moveSelectedToTrash() {
    if (!selected.length) return setMessage("請先選擇文章。");
    if (!window.confirm(`確定將選取的 ${selected.length} 篇文章移至垃圾桶嗎？`)) return;
    const targets = drafts.filter((draft) => selected.includes(draft.draftId) && draft.status !== "trash");
    if (!targets.length) return setMessage("選取的文章已在垃圾桶中。");
    if (await applyWorkflow("trash", targets)) { setMessage(`已將 ${targets.length} 篇文章移至垃圾桶。`); setSelected([]); }
  }

  async function restoreSelected() {
    const ids = drafts.filter((draft) => selected.includes(draft.draftId) && draft.status === "trash").map((draft) => draft.draftId);
    if (!ids.length) return setMessage("選取的文章中沒有垃圾桶項目。");
    const targets = drafts.filter((draft) => ids.includes(draft.draftId));
    if (await applyWorkflow("restore", targets)) { setMessage(`已復原 ${ids.length} 篇文章。`); setSelected([]); }
  }

  const allVisibleSelected = list.length > 0 && list.every((draft) => selected.includes(draft.draftId));
  const statusLabel = (draft: Draft) => draft.status === "published" ? "已發布" : draft.status === "trash" ? "垃圾桶" : "草稿";

  return <main className="min-h-screen bg-[#f5f7f3] px-6 py-8"><nav className="mx-auto flex max-w-7xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/admin" className="text-sm text-[#c1664b]">← 回作者後台</Link></nav><section className="mx-auto max-w-7xl py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm tracking-[0.2em] text-[#c1664b]">STORY LIBRARY</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">文章管理</h1></div><div className="flex flex-wrap justify-end gap-3"><button onClick={restoreSelected} disabled={!selected.length} className="rounded-full border border-[#557166] px-4 py-2 text-sm text-[#557166] disabled:opacity-40">復原</button><button onClick={moveSelectedToTrash} disabled={!selected.length} className="rounded-full border border-[#9a4d42] px-4 py-2 text-sm text-[#9a4d42] disabled:opacity-40">移至垃圾桶</button><button onClick={unpublishSelected} disabled={!selected.length} className="rounded-full border border-[#c1664b] px-4 py-2 text-sm text-[#c1664b] disabled:opacity-40">取消發布</button><button onClick={() => publish(selected)} disabled={!selected.length} className="rounded-full bg-[#c1664b] px-4 py-2 text-sm text-white disabled:opacity-40">發布（{selected.length}）</button></div></div><div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]"><aside className="rounded-3xl bg-white p-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋標題、內容或地點" className="w-full rounded-xl border px-4 py-3 text-sm" /><div className="mt-3 flex flex-wrap gap-2">{["全部", ...cats].map((item) => <button key={item} onClick={() => setCat(item)} className={`rounded-full px-3 py-2 text-xs ${cat === item ? "bg-[#c1664b] text-white" : "bg-[#f0f4f0]"}`}>{item}</button>)}</div><div className="mt-3 flex gap-2"><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border px-2 py-2 text-xs"><option>全部</option><option value="draft">草稿</option><option value="published">已發布</option><option value="trash">垃圾桶</option></select><button onClick={() => setSelected(allVisibleSelected ? selected.filter((id) => !list.some((draft) => draft.draftId === id)) : [...new Set([...selected, ...list.map((draft) => draft.draftId)])])} className="rounded-lg border px-3 py-2 text-xs">{allVisibleSelected ? "取消全選" : "全選目前列表"}</button></div>{message && <p className="mt-3 text-xs text-[#7a8b83]">{message}</p>}<div className="mt-4 space-y-2">{list.map((draft) => <div key={draft.draftId} className={`flex gap-2 rounded-xl p-2 ${active?.draftId === draft.draftId ? "bg-[#f5f7f3]" : ""}`}><input type="checkbox" checked={selected.includes(draft.draftId)} onChange={() => setSelected(selected.includes(draft.draftId) ? selected.filter((id) => id !== draft.draftId) : [...selected, draft.draftId])} /><button onClick={() => setActiveId(draft.draftId)} className="text-left text-sm"><span className="font-medium">{draft.title}</span><span className="block text-xs text-[#9aa8a0]">{statusLabel(draft)} · {draft.category}</span></button></div>)}</div></aside>{active && <article className="rounded-3xl bg-white p-6 sm:p-8"><p className="text-xs text-[#c1664b]">{active.source ?? "website"} · {active.draftId}</p><input aria-label="文章標題" value={active.title} onChange={(event) => edit({ title: event.target.value })} className="mt-3 w-full rounded-xl border px-3 py-3 text-2xl font-semibold" /><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><label>分類<select value={active.category} onChange={(event) => edit({ category: event.target.value })} className="mt-2 w-full rounded-xl border px-3 py-3">{cats.map((item) => <option key={item}>{item}</option>)}</select></label><label>故事日期<input type="date" value={active.publishedAt?.slice(0, 10) ?? ""} onChange={(event) => edit({ publishedAt: event.target.value ? new Date(`${event.target.value}T00:00:00`).toISOString() : null })} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><label>國家<input value={active.country ?? ""} onChange={(event) => edit({ country: event.target.value || null })} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><label>城市<input value={active.city ?? ""} onChange={(event) => edit({ city: event.target.value || null })} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><label>景點<input value={active.attraction ?? ""} onChange={(event) => edit({ attraction: event.target.value || null })} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><label>旅程系列<input value={active.journeySeries ?? ""} onChange={(event) => edit({ journeySeries: event.target.value || null })} className="mt-2 w-full rounded-xl border px-3 py-3" /></label></div><label className="mt-6 block">文章內容<textarea value={active.body} onChange={(event) => edit({ body: event.target.value })} className="mt-2 min-h-72 w-full rounded-2xl border bg-[#fdfcf8] p-5 text-sm leading-7 text-[#718078]" /></label><div className="mt-6 flex flex-wrap gap-3"><button onClick={saveStory} className="rounded-full border border-[#cbd9d1] px-5 py-3 text-sm text-[#557166]">儲存變更</button>{active.status !== "published" && active.status !== "trash" && <button onClick={() => publish([active.draftId])} className="rounded-full bg-[#c1664b] px-5 py-3 text-sm text-white">發布這篇文章</button>}</div>{active.id && <ExistingMediaManager key={active.id} storyId={active.id} />}</article>}</div></section></main>;
}
