"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

type Taxon = { id: string; label: string; kind: "destination" | "topic" | "system"; parent_id: string | null };

export type StoryTaxonomyHandle = {
  validate: () => string | null;
  save: (storyIdOverride?: string) => Promise<void>;
};

const StoryTaxonomyManager = forwardRef<StoryTaxonomyHandle, { storyId?: string | null }>(function StoryTaxonomyManager({ storyId }, ref) {
  const [taxa, setTaxa] = useState<Taxon[]>([]);
  const [rootId, setRootId] = useState("");
  const [childId, setChildId] = useState("");
  const [message, setMessage] = useState("分類載入中…");

  useEffect(() => {
    const controller = new AbortController();
    setTaxa([]);
    setRootId("");
    setChildId("");
    setMessage("分類載入中…");
    const url = storyId ? `/api/story-taxa?storyId=${encodeURIComponent(storyId)}` : "/api/story-taxa";
    fetch(url, { signal: controller.signal })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || "分類載入失敗。");
        const available = (data.taxa as Taxon[]).filter((item) => item.kind !== "system");
        const selected = new Set<string>(data.selected ?? []);
        const selectedChild = available.find((item) => item.parent_id && selected.has(item.id));
        const selectedRoot = selectedChild
          ? available.find((item) => item.id === selectedChild.parent_id)
          : available.find((item) => !item.parent_id && selected.has(item.id));
        setTaxa(available);
        setRootId(selectedRoot?.id ?? "");
        setChildId(selectedChild?.id ?? "");
        setMessage("");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "分類載入失敗。");
      });
    return () => controller.abort();
  }, [storyId]);

  const roots = useMemo(() => taxa.filter((item) => !item.parent_id), [taxa]);
  const children = useMemo(() => taxa.filter((item) => item.parent_id === rootId), [taxa, rootId]);

  function validate() {
    if (!rootId) return "請選擇文章分類。";
    if (children.length && !childId) return "這個分類還有子分類，請繼續選擇國家或子分類。";
    return null;
  }

  async function save(storyIdOverride?: string) {
    const targetStoryId = storyIdOverride ?? storyId;
    const validationError = validate();
    if (validationError) throw new Error(validationError);
    if (!targetStoryId) throw new Error("請先建立文章，再儲存分類。");
    const response = await fetch("/api/story-taxa", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storyId: targetStoryId, taxonIds: [childId || rootId] }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "分類儲存失敗。");
  }

  useImperativeHandle(ref, () => ({ validate, save }));

  return (
    <section className="mt-6 rounded-2xl bg-[#f5f7f3] p-5">
      <h3 className="font-medium text-[#31413d]">文章分類</h3>
      <p className="mt-1 text-xs text-[#7a8b83]">分類與 Navbar 使用同一份資料；有子分類時必須繼續選擇。</p>
      {message && <p className="mt-3 text-sm text-[#718078]">{message}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-[#52655d]">
          主分類
          <select value={rootId} onChange={(event) => { setRootId(event.target.value); setChildId(""); }} className="mt-2 w-full rounded-xl border border-[#d3dfd8] bg-white px-3 py-3">
            <option value="">請選擇主分類</option>
            {roots.map((root) => <option key={root.id} value={root.id}>{root.label}</option>)}
          </select>
        </label>
        {rootId && children.length > 0 && (
          <label className="text-sm text-[#52655d]">
            子分類
            <select value={childId} onChange={(event) => setChildId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d3dfd8] bg-white px-3 py-3">
              <option value="">請繼續選擇</option>
              {children.map((child) => <option key={child.id} value={child.id}>{child.label}</option>)}
            </select>
          </label>
        )}
      </div>
    </section>
  );
});

export default StoryTaxonomyManager;
