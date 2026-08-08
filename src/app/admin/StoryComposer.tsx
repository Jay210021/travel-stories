"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { runStoryWorkflow } from "@/lib/story-workflow";
import PhotoUploader from "./PhotoUploader";
import VideoUploader from "./VideoUploader";
import ContentSafety from "./ContentSafety";

const categories = ["國外旅行", "台灣旅行", "日常生活"];
type Form = { title: string; body: string; category: string; country: string; city: string; attraction: string; journeySeries: string; publishedAt: string };
const initialForm: Form = { title: "", body: "", category: categories[0], country: "", city: "", attraction: "", journeySeries: "", publishedAt: "" };

export default function StoryComposer({ accountStatus }: { accountStatus: string }) {
  const [form, setForm] = useState(initialForm);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");

  function change<K extends keyof Form>(field: K, value: Form[K]) { setForm((current) => ({ ...current, [field]: value })); }

  async function saveDraft() {
    if (!form.title.trim()) { setMessage("請先填寫文章標題。"); return null; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("找不到 Supabase 設定。"); return null; }
    setSaving(true); setMessage("");
    const values = { title: form.title.trim(), body: form.body, category: form.category, country: form.country || null, city: form.city || null, attraction: form.attraction || null, journey_series: form.journeySeries || null, published_at: form.publishedAt ? new Date(`${form.publishedAt}T00:00:00`).toISOString() : null, updated_at: new Date().toISOString() };
    if (storyId) {
      const { error } = await supabase.from("stories").update(values).eq("id", storyId);
      setMessage(error ? `儲存失敗：${error.message}` : "草稿已儲存。");
      setSaving(false); return error ? null : storyId;
    }
    const nextSourceId = `website-${crypto.randomUUID()}`;
    const { data, error } = await supabase.from("stories").insert({ ...values, source: "website", source_id: nextSourceId, status: "draft" }).select("id,source_id").single();
    if (error) setMessage(`儲存失敗：${error.message}`);
    else { setStoryId(data.id); setSourceId(data.source_id); setMessage("草稿已建立，現在可以上傳照片或影片。"); }
    setSaving(false); return error ? null : data.id;
  }

  async function publish() {
    const savedStoryId = await saveDraft();
    if (!savedStoryId) return;
    try { await runStoryWorkflow("publish", [savedStoryId]); setMessage("文章已發布，可在公開首頁看到。"); }
    catch (error) { setMessage(`發布失敗：${error instanceof Error ? error.message : "請再試一次"}`); }
  }

  return <main className="min-h-screen px-6 py-8"><section className="mx-auto max-w-6xl py-8 sm:py-12">
    <p className="text-sm tracking-[0.2em] text-[#c1664b]">AUTHOR SPACE</p>
    <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold text-[#31413d]">寫一篇新的故事</h1><p className="mt-3 text-[#718078]">先存成草稿，確認後再公開。</p></div><span className="text-sm text-[#7a8b83]">{accountStatus}</span></div>
    <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_280px]">
      <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <label className="block text-sm font-medium text-[#52655d]">文章標題<input value={form.title} onChange={(event) => change("title", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3 text-lg outline-none focus:border-[#c1664b]" placeholder="例如：在米蘭大教堂，遇見一場細雨" /></label>
        <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-[#52655d]">文章分類<select value={form.category} onChange={(event) => change("category", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] bg-white px-4 py-3">{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm font-medium text-[#52655d]">故事日期<input value={form.publishedAt} onChange={(event) => change("publishedAt", event.target.value)} type="date" className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-[#52655d]">國家<input value={form.country} onChange={(event) => change("country", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label><label className="text-sm font-medium text-[#52655d]">城市<input value={form.city} onChange={(event) => change("city", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label><label className="text-sm font-medium text-[#52655d]">景點<input value={form.attraction} onChange={(event) => change("attraction", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label><label className="text-sm font-medium text-[#52655d]">旅程系列<input value={form.journeySeries} onChange={(event) => change("journeySeries", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label></div>
        <label className="mt-6 block text-sm font-medium text-[#52655d]">故事內容<textarea value={form.body} onChange={(event) => change("body", event.target.value)} className="mt-2 min-h-64 w-full rounded-xl border border-[#dce5de] px-4 py-3 leading-7 outline-none focus:border-[#c1664b]" placeholder="寫下這趟旅程裡最想留下的片段⋯" /></label>
        <PhotoUploader storyId={storyId} /><VideoUploader storyId={storyId} />
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={saveDraft} disabled={saving} className="rounded-full border border-[#cbd9d1] px-5 py-3 text-sm text-[#557166] disabled:opacity-40">{saving ? "儲存中…" : storyId ? "儲存變更" : "儲存草稿"}</button><button onClick={() => setPreview(true)} className="rounded-full border border-[#c1664b] px-5 py-3 text-sm text-[#c1664b]">預覽文章</button><button onClick={publish} disabled={saving} className="rounded-full bg-[#c1664b] px-5 py-3 text-sm text-white disabled:opacity-40">發布文章</button></div>
        {sourceId && <p className="mt-4 text-xs text-[#9aa8a0]">草稿編號：{sourceId}</p>}{message && <p className="mt-3 text-right text-sm text-[#648276]">{message}</p>}
      </div>
      <aside className="space-y-4"><ContentSafety /></aside>
    </div>
    {preview && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4 sm:p-10"><article className="mx-auto max-w-3xl rounded-3xl bg-[#fdfcf8] p-7 shadow-2xl sm:p-12"><button onClick={() => setPreview(false)} className="float-right rounded-full border px-4 py-2 text-sm">關閉</button><p className="text-xs tracking-[0.16em] text-[#c1664b]">{form.category} · {form.country} {form.city}</p><h1 className="mt-5 text-4xl font-semibold leading-tight text-[#31413d]">{form.title || "未命名文章"}</h1><p className="mt-3 text-sm text-[#718078]">{[form.attraction, form.journeySeries, form.publishedAt].filter(Boolean).join(" · ")}</p><div className="mt-10 whitespace-pre-wrap text-lg leading-9 text-[#667870]">{form.body || "（尚未填寫內容）"}</div></article></div>}
  </section></main>;
}
