"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { runStoryWorkflow, type StoryWorkflowAction } from "@/lib/story-workflow";
import ExistingMediaManager from "./ExistingMediaManager";
import StoryTaxonomyManager, { type StoryTaxonomyHandle } from "./StoryTaxonomyManager";
import ActionDialog from "../ActionDialog";

type Draft = {
  id?: string;
  draftId: string;
  source?: string;
  status: string;
  title: string;
  body: string;
  publishedAt: string | null;
  deletedAt?: string | null;
  media: { path: string; order: number; isCover: boolean; caption: string; alt: string }[];
  review: { needsLocation: boolean; needsPrivacyCheck: boolean; readyToPublish: boolean };
};
type StoryRow = { id: string; source: string; source_id: string; status: string; title: string; body: string; published_at: string | null; deleted_at: string | null };
const emptyReview = { needsLocation: false, needsPrivacyCheck: false, readyToPublish: false };
type PublishRequest = { ids: string[]; saveActiveFirst: boolean };
type PublishResult = { success: boolean; description: string };
type OperationResult = { ok: true } | { ok: false; error: string };

export default function DraftManager({ initialDrafts }: { initialDrafts: Draft[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState(initialDrafts[0]?.draftId ?? "");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部");
  const [message, setMessage] = useState("正在連接 Supabase…");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishRequest, setPublishRequest] = useState<PublishRequest | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const taxonomyRef = useRef<StoryTaxonomyHandle>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.from("stories").select("id,source,source_id,status,title,body,published_at,deleted_at").order("updated_at", { ascending: false }).then(({ data, error }) => {
      if (error) return setMessage(`載入失敗：${error.message}`);
      const rows = (data ?? []) as StoryRow[];
      setDrafts((local) => rows.map((row) => {
        const fallback = local.find((draft) => draft.draftId === row.source_id);
        return { id: row.id, draftId: row.source_id, source: row.source, status: row.status, title: row.title, body: row.body, publishedAt: row.published_at ?? fallback?.publishedAt ?? null, deletedAt: row.deleted_at, media: fallback?.media ?? [], review: fallback?.review ?? emptyReview };
      }));
      setActiveId((current) => rows.some((row) => row.source_id === current) ? current : rows[0]?.source_id ?? "");
      setMessage("");
    });
  }, []);

  const list = useMemo(() => drafts.filter((draft) => (status === "全部" || draft.status === status) && `${draft.title} ${draft.body}`.toLowerCase().includes(query.toLowerCase())), [drafts, status, query]);
  const active = drafts.find((draft) => draft.draftId === activeId) ?? list[0];
  const edit = (changes: Partial<Draft>) => active && setDrafts((items) => items.map((draft) => draft.draftId === active.draftId ? { ...draft, ...changes } : draft));

  async function saveStory(): Promise<OperationResult> {
    if (!active?.id) { const error = "這篇文章尚未同步到 Supabase。"; setMessage(error); return { ok: false, error }; }
    if (!active.title.trim()) { const error = "請填寫文章標題。"; setMessage(error); return { ok: false, error }; }
    const classificationError = taxonomyRef.current?.validate();
    if (classificationError) { setMessage(classificationError); return { ok: false, error: classificationError }; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { const error = "找不到 Supabase 設定。"; setMessage(error); return { ok: false, error }; }
    setSaving(true);
    try {
      if (active.source === "facebook" && active.draftId.startsWith("facebook-live:")) {
        const { error } = await supabase.rpc("save_facebook_editorial_story", { p_story_id: active.id, p_title: active.title.trim(), p_body: active.body, p_published_at: active.publishedAt, p_taxon_id: taxonomyRef.current?.selectedTaxonId() });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stories").update({ title: active.title.trim(), body: active.body, published_at: active.publishedAt, updated_at: new Date().toISOString() }).eq("id", active.id);
        if (error) throw error;
        await taxonomyRef.current?.save(active.id);
      }
      setMessage("文章已儲存。");
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "請稍後再試。";
      setMessage(`儲存失敗：${reason}`);
      return { ok: false, error: reason };
    } finally { setSaving(false); }
  }

  async function applyWorkflow(action: StoryWorkflowAction, targets: Draft[]): Promise<OperationResult> {
    const storyIds = targets.flatMap((draft) => draft.id ? [draft.id] : []);
    if (storyIds.length !== targets.length) { const error = "部分文章尚未同步到 Supabase，請重新整理後再試。"; setMessage(error); return { ok: false, error }; }
    try {
      const result = await runStoryWorkflow(action, storyIds);
      const updates = new Map(result.map((story) => [story.id, story]));
      setDrafts((items) => items.map((draft) => {
        const update = draft.id ? updates.get(draft.id) : undefined;
        return update ? { ...draft, status: update.status, publishedAt: update.published_at, deletedAt: update.deleted_at } : draft;
      }));
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "文章狀態變更失敗。";
      setMessage(reason);
      return { ok: false, error: reason };
    }
  }

  function requestPublish(ids: string[], saveActiveFirst = false) {
    if (!ids.length) return setMessage("請先選擇文章。");
    const targets = drafts.filter((draft) => ids.includes(draft.draftId) && draft.status !== "trash");
    if (!targets.length) return setMessage("沒有可發布的文章。");
    setPublishRequest({ ids, saveActiveFirst });
  }

  async function confirmPublish() {
    if (!publishRequest) return;
    const request = publishRequest;
    setPublishing(true);
    const saveResult = request.saveActiveFirst ? await saveStory() : { ok: true } as OperationResult;
    if (!saveResult.ok) {
      setPublishing(false);
      setPublishRequest(null);
      setPublishResult({ success: false, description: `發布前無法儲存文章或分類。\n\n失敗原因：${saveResult.error}` });
      return;
    }
    const targets = drafts.filter((draft) => request.ids.includes(draft.draftId) && draft.status !== "trash");
    const workflowResult = await applyWorkflow("publish", targets);
    setPublishing(false);
    setPublishRequest(null);
    if (workflowResult.ok) {
      setSelected([]);
      setMessage(`已發布 ${targets.length} 篇文章。`);
      setPublishResult({ success: true, description: targets.length === 1 ? "文章已成功發布，現在可以在前台查看。" : `${targets.length} 篇文章已成功發布。` });
    } else {
      setPublishResult({ success: false, description: `文章發布失敗。\n\n失敗原因：${workflowResult.error}` });
    }
  }

  async function unpublishSelected() {
    const targets = drafts.filter((draft) => selected.includes(draft.draftId) && draft.status === "published");
    if (!targets.length) return setMessage("選取的文章中沒有已發布文章。");
    if (!window.confirm(`確定取消發布選取的 ${targets.length} 篇文章？`)) return;
    if ((await applyWorkflow("unpublish", targets)).ok) { setSelected([]); setMessage(`已取消發布 ${targets.length} 篇文章。`); }
  }

  async function moveSelectedToTrash() {
    if (!selected.length) return setMessage("請先選擇文章。");
    const targets = drafts.filter((draft) => selected.includes(draft.draftId) && draft.status !== "trash");
    if (!targets.length) return setMessage("選取的文章都已在垃圾桶中。");
    if (!window.confirm(`確定將 ${targets.length} 篇文章移至垃圾桶？`)) return;
    if ((await applyWorkflow("trash", targets)).ok) { setMessage(`已將 ${targets.length} 篇文章移至垃圾桶。`); setSelected([]); }
  }

  async function restoreSelected() {
    const targets = drafts.filter((draft) => selected.includes(draft.draftId) && draft.status === "trash");
    if (!targets.length) return setMessage("選取的文章中沒有垃圾桶文章。");
    if ((await applyWorkflow("restore", targets)).ok) { setMessage(`已復原 ${targets.length} 篇文章。`); setSelected([]); }
  }

  const allVisibleSelected = list.length > 0 && list.every((draft) => selected.includes(draft.draftId));
  const statusLabel = (draft: Draft) => draft.status === "published" ? "已發布" : draft.status === "trash" ? "垃圾桶" : "草稿";

  return (
    <main className="min-h-screen bg-[#f5f7f3] px-6 py-8">
      <nav className="mx-auto flex max-w-7xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/admin" className="text-sm text-[#c1664b]">← 回作者後台</Link></nav>
      <section className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm tracking-[0.2em] text-[#c1664b]">STORY LIBRARY</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">文章管理</h1></div>
          <div className="flex flex-wrap justify-end gap-3">
            <button onClick={restoreSelected} disabled={!selected.length} className="rounded-full border border-[#557166] px-4 py-2 text-sm text-[#557166] disabled:opacity-40">復原</button>
            <button onClick={moveSelectedToTrash} disabled={!selected.length} className="rounded-full border border-[#9a4d42] px-4 py-2 text-sm text-[#9a4d42] disabled:opacity-40">移至垃圾桶</button>
            <button onClick={unpublishSelected} disabled={!selected.length} className="rounded-full border border-[#c1664b] px-4 py-2 text-sm text-[#c1664b] disabled:opacity-40">取消發布</button>
            <button onClick={() => requestPublish(selected)} disabled={!selected.length} className="rounded-full bg-[#c1664b] px-4 py-2 text-sm text-white disabled:opacity-40">發布（{selected.length}）</button>
          </div>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="rounded-3xl bg-white p-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋標題或內容" className="w-full rounded-xl border px-4 py-3 text-sm" />
            <div className="mt-3 flex gap-2"><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border px-2 py-2 text-xs"><option>全部</option><option value="draft">草稿</option><option value="published">已發布</option><option value="trash">垃圾桶</option></select><button onClick={() => setSelected(allVisibleSelected ? selected.filter((id) => !list.some((draft) => draft.draftId === id)) : [...new Set([...selected, ...list.map((draft) => draft.draftId)])])} className="rounded-lg border px-3 py-2 text-xs">{allVisibleSelected ? "取消全選" : "全選目前列表"}</button></div>
            {message && <p className="mt-3 text-xs text-[#7a8b83]">{message}</p>}
            <div className="mt-4 space-y-2">{list.map((draft) => <div key={draft.draftId} className={`flex gap-2 rounded-xl p-2 ${active?.draftId === draft.draftId ? "bg-[#f5f7f3]" : ""}`}><input type="checkbox" checked={selected.includes(draft.draftId)} onChange={() => setSelected(selected.includes(draft.draftId) ? selected.filter((id) => id !== draft.draftId) : [...selected, draft.draftId])} /><button onClick={() => setActiveId(draft.draftId)} className="text-left text-sm"><span className="font-medium">{draft.title}</span><span className="block text-xs text-[#9aa8a0]">{statusLabel(draft)}</span></button></div>)}</div>
          </aside>
          {active && (
            <article key={active.draftId} className="rounded-3xl bg-white p-6 sm:p-8">
              <p className="text-xs text-[#c1664b]">{active.source ?? "website"} · {active.draftId}</p>
              <input aria-label="文章標題" value={active.title} onChange={(event) => edit({ title: event.target.value })} className="mt-3 w-full rounded-xl border px-3 py-3 text-2xl font-semibold" />
              <label className="mt-6 block max-w-sm">故事日期<input type="date" value={active.publishedAt?.slice(0, 10) ?? ""} onChange={(event) => edit({ publishedAt: event.target.value ? `${event.target.value}T12:00:00.000Z` : null })} className="mt-2 w-full rounded-xl border px-3 py-3" /></label>
              <StoryTaxonomyManager ref={taxonomyRef} storyId={active.id} />
              <label className="mt-6 block">文章內容<textarea value={active.body} onChange={(event) => edit({ body: event.target.value })} className="mt-2 min-h-72 w-full rounded-2xl border bg-[#fdfcf8] p-5 text-sm leading-7 text-[#718078]" /></label>
              <div className="mt-6 flex flex-wrap gap-3"><button onClick={saveStory} disabled={saving || publishing} className="rounded-full border border-[#cbd9d1] px-5 py-3 text-sm text-[#557166] disabled:opacity-50">{saving ? "儲存中…" : "儲存"}</button>{active.status !== "published" && active.status !== "trash" && <button onClick={() => requestPublish([active.draftId], true)} disabled={saving || publishing} className="rounded-full bg-[#c1664b] px-5 py-3 text-sm text-white disabled:opacity-50">發布這篇文章</button>}</div>
              {active.id && <ExistingMediaManager key={active.id} storyId={active.id} />}
            </article>
          )}
        </div>
      </section>
      <ActionDialog open={Boolean(publishRequest)} title="是否確認發布文章？" description={publishRequest?.ids.length === 1 ? "發布後，這篇文章將會顯示在前台。" : `發布後，選取的 ${publishRequest?.ids.length ?? 0} 篇文章將會顯示在前台。`} primaryLabel="確認發布" secondaryLabel="取消" busy={publishing} onPrimary={() => void confirmPublish()} onSecondary={() => setPublishRequest(null)} />
      <ActionDialog open={Boolean(publishResult)} title={publishResult?.success ? "發布成功" : "發布失敗"} description={publishResult?.description ?? ""} primaryLabel="知道了" tone={publishResult?.success ? "success" : "error"} onPrimary={() => setPublishResult(null)} />
    </main>
  );
}
