"use client";

import { useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { runStoryWorkflow } from "@/lib/story-workflow";
import PhotoUploader from "./PhotoUploader";
import VideoUploader from "./VideoUploader";
import ContentSafety from "./ContentSafety";
import StoryTaxonomyManager, { type StoryTaxonomyHandle } from "./drafts/StoryTaxonomyManager";
import ActionDialog from "./ActionDialog";

type Form = { title: string; body: string; publishedAt: string };
const initialForm: Form = { title: "", body: "", publishedAt: "" };
type SaveDraftResult = { storyId: string; error?: never } | { storyId: null; error: string };

export default function StoryComposer({ accountStatus }: { accountStatus: string }) {
  const [form, setForm] = useState(initialForm);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; description: string } | null>(null);
  const taxonomyRef = useRef<StoryTaxonomyHandle>(null);

  function change<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveDraft(): Promise<SaveDraftResult> {
    if (!form.title.trim()) { const error = "請先填寫文章標題。"; setMessage(error); return { storyId: null, error }; }
    const classificationError = taxonomyRef.current?.validate();
    if (classificationError) { setMessage(classificationError); return { storyId: null, error: classificationError }; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { const error = "找不到 Supabase 設定。"; setMessage(error); return { storyId: null, error }; }
    setSaving(true);
    setMessage("");
    try {
      const values = { title: form.title.trim(), body: form.body, published_at: form.publishedAt ? `${form.publishedAt}T12:00:00.000Z` : null, updated_at: new Date().toISOString() };
      let savedStoryId = storyId;
      if (savedStoryId) {
        const { error } = await supabase.from("stories").update(values).eq("id", savedStoryId);
        if (error) throw error;
      } else {
        const nextSourceId = `website-${crypto.randomUUID()}`;
        const { data, error } = await supabase.from("stories").insert({ ...values, source: "website", source_id: nextSourceId, status: "draft" }).select("id,source_id").single();
        if (error) throw error;
        savedStoryId = data.id;
        setStoryId(data.id);
        setSourceId(data.source_id);
      }
      if (!savedStoryId) throw new Error("文章建立失敗，沒有取得文章識別碼。");
      await taxonomyRef.current?.save(savedStoryId);
      setMessage("文章已儲存。");
      return { storyId: savedStoryId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "請稍後再試。";
      setMessage(`儲存失敗：${reason}`);
      return { storyId: null, error: reason };
    } finally { setSaving(false); }
  }

  async function publish() {
    setPublishing(true);
    const saveResult = await saveDraft();
    if (!saveResult.storyId) {
      setPublishing(false);
      setConfirmingPublish(false);
      setPublishResult({ success: false, description: `發布前無法儲存文章或分類。\n\n失敗原因：${saveResult.error}` });
      return;
    }
    try {
      await runStoryWorkflow("publish", [saveResult.storyId]);
      setMessage("文章已發布，可以在首頁查看。");
      setPublishResult({ success: true, description: "文章已成功發布，現在可以在前台查看。" });
    } catch (error) {
      const description = error instanceof Error ? error.message : "請稍後再試。";
      setMessage(`發布失敗：${description}`);
      setPublishResult({ success: false, description: `文章發布失敗：${description}` });
    } finally {
      setPublishing(false);
      setConfirmingPublish(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-6xl py-8 sm:py-12">
        <p className="text-sm tracking-[0.2em] text-[#c1664b]">AUTHOR SPACE</p>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold text-[#31413d]">撰寫一篇新的故事</h1><p className="mt-3 text-[#718078]">從文字開始，再補上照片或影片。</p></div><span className="text-sm text-[#7a8b83]">{accountStatus}</span></div>
        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_280px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <label className="block text-sm font-medium text-[#52655d]">文章標題<input value={form.title} onChange={(event) => change("title", event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3 text-lg outline-none focus:border-[#c1664b]" placeholder="例如：在米蘭大教堂遇見一場細雨" /></label>
            <label className="mt-6 block max-w-sm text-sm font-medium text-[#52655d]">故事日期<input value={form.publishedAt} onChange={(event) => change("publishedAt", event.target.value)} type="date" className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label>
            <StoryTaxonomyManager ref={taxonomyRef} storyId={storyId} />
            <label className="mt-6 block text-sm font-medium text-[#52655d]">文章內容<textarea value={form.body} onChange={(event) => change("body", event.target.value)} className="mt-2 min-h-64 w-full rounded-xl border border-[#dce5de] px-4 py-3 leading-7 outline-none focus:border-[#c1664b]" placeholder="寫下旅程、心情與值得記住的細節。" /></label>
            <PhotoUploader storyId={storyId} />
            <VideoUploader storyId={storyId} />
            <div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={saveDraft} disabled={saving || publishing} className="rounded-full border border-[#cbd9d1] px-5 py-3 text-sm text-[#557166] disabled:opacity-40">{saving ? "儲存中…" : "儲存"}</button><button onClick={() => setPreview(true)} className="rounded-full border border-[#c1664b] px-5 py-3 text-sm text-[#c1664b]">預覽文章</button><button onClick={() => setConfirmingPublish(true)} disabled={saving || publishing} className="rounded-full bg-[#c1664b] px-5 py-3 text-sm text-white disabled:opacity-40">發布文章</button></div>
            {sourceId && <p className="mt-4 text-xs text-[#9aa8a0]">草稿識別碼：{sourceId}</p>}
            {message && <p className="mt-3 text-right text-sm text-[#648276]">{message}</p>}
          </div>
          <aside className="space-y-4"><ContentSafety /></aside>
        </div>
        {preview && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4 sm:p-10"><article className="mx-auto max-w-3xl rounded-3xl bg-[#fdfcf8] p-7 shadow-2xl sm:p-12"><button onClick={() => setPreview(false)} className="float-right rounded-full border px-4 py-2 text-sm">關閉</button><h1 className="mt-5 text-4xl font-semibold leading-tight text-[#31413d]">{form.title || "未命名文章"}</h1><p className="mt-3 text-sm text-[#718078]">{form.publishedAt}</p><div className="mt-10 whitespace-pre-wrap text-lg leading-9 text-[#667870]">{form.body || "（尚未填寫內容）"}</div></article></div>}
        <ActionDialog open={confirmingPublish} title="是否確認發布文章？" description="發布後，這篇文章將會顯示在前台。" primaryLabel="確認發布" secondaryLabel="取消" busy={publishing} onPrimary={() => void publish()} onSecondary={() => setConfirmingPublish(false)} />
        <ActionDialog open={Boolean(publishResult)} title={publishResult?.success ? "發布成功" : "發布失敗"} description={publishResult?.description ?? ""} primaryLabel="知道了" tone={publishResult?.success ? "success" : "error"} onPrimary={() => setPublishResult(null)} />
      </section>
    </main>
  );
}
