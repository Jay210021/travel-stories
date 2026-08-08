"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isCurrentUserAuthor } from "@/lib/supabase-browser";
import { runStoryWorkflow } from "@/lib/story-workflow";

const categories = ["國外旅行", "台灣旅行", "日常生活"];

export default function ArticleEditor({ storyId, sourceId, title, category, country, city }: { storyId: string; sourceId: string; title: string; category: string; country: string | null; city: string | null }) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title, category, country: country ?? "", city: city ?? "" });
  const [message, setMessage] = useState("");

  useEffect(() => { isCurrentUserAuthor().then(setAllowed); }, []);
  if (!allowed) return null;

  async function save() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("stories").update({ title: form.title, category: form.category, country: form.country || null, city: form.city || null, updated_at: new Date().toISOString() }).eq("source_id", sourceId);
    setMessage(error ? `儲存失敗：${error.message}` : "已儲存，重新整理後可看到更新。");
    if (!error) setOpen(false);
  }

  async function unpublish() {
    if (!window.confirm("確定要取消發布這篇文章嗎？")) return;
    try { await runStoryWorkflow("unpublish", [storyId]); setMessage("已取消發布，請回到草稿管理頁確認。"); }
    catch (error) { setMessage(`取消發布失敗：${error instanceof Error ? error.message : "請再試一次"}`); }
  }

  return <div className="mt-6">{open ? <div className="rounded-2xl bg-[#f5f7f3] p-5"><div className="grid gap-4 sm:grid-cols-2"><label>標題<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" /></label><label>分類<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2">{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>國家<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" /></label><label>城市<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2" /></label></div><button onClick={save} className="mt-4 rounded-full bg-[#31413d] px-4 py-2 text-sm text-white">儲存變更</button><button onClick={() => setOpen(false)} className="ml-3 rounded-full border px-4 py-2 text-sm">取消</button></div> : <div className="flex flex-wrap gap-3"><button onClick={() => setOpen(true)} className="rounded-full border border-[#cbd9d1] px-4 py-2 text-sm text-[#557166]">編輯文章</button><button onClick={unpublish} className="rounded-full border border-[#c1664b] px-4 py-2 text-sm text-[#c1664b]">取消發布</button></div>}{message && <p className="mt-3 text-sm text-[#648276]">{message}</p>}</div>;
}
