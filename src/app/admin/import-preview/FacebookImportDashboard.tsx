"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Settings = { state: "disconnected" | "testing" | "active" | "interrupted"; page_id: string | null; activated_at: string | null; last_checked_at: string | null; last_success_at: string | null; last_error: string | null; graph_api_version: string };
type ImportRow = { id: string; post_id: string; story_id: string | null; status: string; source_permalink: string | null; source_created_at: string | null; attention_reason: string | null; attempt_count: number; possible_duplicate_story_id: string | null; updated_at: string };
type Attempt = { id: number; post_id: string; attempt_number: number; outcome: string; stage: string; error_code: string | null; error_reason: string | null; started_at: string; finished_at: string };
type StoryOption = { id: string; title: string; status: string };
type DashboardData = { settings: Settings; imports: ImportRow[]; attempts: Attempt[]; stories: StoryOption[] };

const stateLabel: Record<string, string> = { disconnected: "尚未連線", testing: "測試完成，等待啟用", active: "自動匯入運作中", interrupted: "同步已中斷" };
const importLabel: Record<string, string> = { pending: "待處理", processing: "處理中", succeeded: "成功", needs_attention: "需人工處理", failed: "失敗", update_pending: "有更新待確認", source_removed: "原文已移除" };

export default function FacebookImportDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("同步狀態載入中…");
  const [postId, setPostId] = useState("");
  const [busy, setBusy] = useState(false);
  const [attemptFilter, setAttemptFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/facebook-import", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "無法載入 Facebook 同步狀態");
    setData(result); setMessage("");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((error) => setMessage(error.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(actionName: string, targetPostId?: string, extra: Record<string, string> = {}) {
    if (actionName === "apply_latest" && !window.confirm("套用 Facebook 最新內容會取代網站目前的標題、內文與自動匯入媒體，確定繼續？")) return;
    setBusy(true); setMessage("處理中…");
    try {
      const response = await fetch("/api/facebook-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, postId: targetPostId, ...extra }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "操作失敗");
      setMessage(actionName === "test" ? "測試草稿已建立，請先檢查內容再啟用。" : actionName === "activate" ? "Facebook 自動匯入已啟用。" : actionName === "check" ? `檢查完成，共讀取 ${result.imported ?? 0} 篇貼文。` : actionName === "apply_latest" ? "已取消公開並套用 Facebook 最新內容，請重新確認標題與分類後再發布。" : actionName === "link_existing" ? "已連結到既有文章，原本的重複草稿已移至垃圾桶。" : "重新嘗試完成。");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失敗"); }
    finally { setBusy(false); }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of data?.imports || []) result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, [data]);
  const attempts = useMemo(() => (data?.attempts || []).filter((item) => {
    const time = new Date(item.finished_at).getTime();
    return (attemptFilter === "all" || item.outcome === attemptFilter)
      && (!query || item.post_id.toLowerCase().includes(query.toLowerCase()) || item.error_reason?.toLowerCase().includes(query.toLowerCase()))
      && (!fromDate || time >= new Date(`${fromDate}T00:00:00`).getTime())
      && (!toDate || time <= new Date(`${toDate}T23:59:59.999`).getTime());
  }), [data, attemptFilter, query, fromDate, toDate]);

  return <main className="min-h-screen bg-[#f5f7f3] px-5 py-8 sm:px-8">
    <nav className="mx-auto flex max-w-6xl justify-between"><Link href="/" className="font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><Link href="/admin" className="text-sm text-[#c1664b]">← 回作者後台</Link></nav>
    <section className="mx-auto max-w-6xl py-10">
      <p className="text-sm tracking-[0.2em] text-[#c1664b]">FACEBOOK AUTO IMPORT</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">Facebook 自動匯入</h1>
      <p className="mt-4 max-w-3xl leading-7 text-[#718078]">粉專的新貼文只會建立草稿，確認標題、分類與媒體後才由作者發布。影片與 Reels 第一版會標示為需人工處理。</p>
      {message && <p className="mt-6 rounded-2xl border border-[#dce6e0] bg-white p-4 text-sm text-[#64776d]">{message}</p>}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs tracking-[0.14em] text-[#8a9991]">連線狀態</p><h2 className="mt-2 text-xl font-semibold text-[#31413d]">{stateLabel[data?.settings.state || "disconnected"]}</h2></div><span className="rounded-full bg-[#edf4ef] px-3 py-1 text-xs text-[#557166]">{data?.settings.graph_api_version || "v24.0"}</span></div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2"><Info label="粉專 ID" value={data?.settings.page_id || "尚未設定"}/><Info label="啟用時間" value={formatDate(data?.settings.activated_at)}/><Info label="最近成功" value={formatDate(data?.settings.last_success_at)}/><Info label="最近補漏" value={formatDate(data?.settings.last_checked_at)}/></dl>
          {data?.settings.last_error && <p className="mt-5 rounded-2xl bg-[#fff1ee] p-4 text-sm text-[#9a4d42]">{data.settings.last_error}</p>}
          <div className="mt-6 flex flex-wrap gap-3"><button disabled={busy || data?.settings.state !== "testing"} onClick={() => action("activate")} className="rounded-full bg-[#c1664b] px-5 py-2 text-sm text-white disabled:opacity-40">啟用自動匯入</button><button disabled={busy || data?.settings.state !== "active"} onClick={() => action("check")} className="rounded-full border border-[#557166] px-5 py-2 text-sm text-[#557166] disabled:opacity-40">立即檢查新貼文</button></div>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="font-semibold text-[#31413d]">連線測試</h2><p className="mt-2 text-sm leading-6 text-[#718078]">建立 Meta App 並完成環境變數後，貼上指定測試貼文的 Facebook Post ID。測試只建立草稿。</p><input value={postId} onChange={(event) => setPostId(event.target.value)} placeholder="例如：PAGE_ID_POST_ID" className="mt-5 w-full rounded-xl border border-[#d3dfd8] px-4 py-3 text-sm"/><button disabled={busy || !postId.trim()} onClick={() => action("test", postId.trim())} className="mt-3 rounded-full border border-[#c1664b] px-5 py-2 text-sm text-[#c1664b] disabled:opacity-40">建立測試草稿</button></section>
      </div>
      <section className="mt-8"><h2 className="text-xl font-semibold text-[#31413d]">目前匯入狀態</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{["pending","succeeded","needs_attention","failed","update_pending","source_removed"].map((status) => <div key={status} className="rounded-2xl bg-white p-4"><p className="text-xs text-[#819087]">{importLabel[status]}</p><strong className="mt-2 block text-2xl text-[#31413d]">{counts[status] || 0}</strong></div>)}</div></section>
      <section className="mt-8 rounded-3xl bg-white p-6"><h2 className="font-semibold text-[#31413d]">最近貼文</h2><div className="mt-5 space-y-3">{(data?.imports || []).map((item) => <article key={item.id} className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] pb-4 sm:flex-row sm:items-center"><div><p className="text-sm font-medium text-[#42554d]">{item.post_id}</p><p className="mt-1 text-xs text-[#8a9991]">{importLabel[item.status] || item.status} · 嘗試 {item.attempt_count} 次 · {formatDate(item.updated_at)}</p>{item.attention_reason && <p className="mt-2 text-sm text-[#9a4d42]">{item.attention_reason}</p>}</div><ImportActions item={item} stories={data?.stories || []} busy={busy} onAction={action}/></article>)}{!data?.imports.length && <p className="text-sm text-[#8a9991]">尚無自動匯入貼文。</p>}</div></section>
      <section className="mt-8 rounded-3xl bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-semibold text-[#31413d]">Facebook 匯入嘗試（保留 180 天）</h2><div className="flex flex-wrap gap-2"><select value={attemptFilter} onChange={(event) => setAttemptFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="all">全部結果</option><option value="succeeded">成功</option><option value="needs_attention">需人工處理</option><option value="failed">失敗</option><option value="update_pending">有更新待確認</option></select><input type="date" aria-label="匯入嘗試起始日期" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"/><input type="date" aria-label="匯入嘗試結束日期" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋貼文或錯誤" className="rounded-lg border px-3 py-2 text-sm"/></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs text-[#8a9991]"><tr><th className="pb-3">時間</th><th>貼文</th><th>結果</th><th>階段</th><th>原因</th></tr></thead><tbody>{attempts.map((item) => <tr key={item.id} className="border-t border-[#edf0ed]"><td className="py-3">{formatDate(item.finished_at)}</td><td>{item.post_id}</td><td>{importLabel[item.outcome] || item.outcome}</td><td>{item.stage}</td><td className="max-w-md text-[#9a4d42]">{[item.error_code, item.error_reason].filter(Boolean).join("：") || "—"}</td></tr>)}</tbody></table>{!attempts.length && <p className="py-6 text-sm text-[#8a9991]">沒有符合的 Facebook 匯入嘗試。</p>}</div></section>
    </section>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[#8a9991]">{label}</dt><dd className="mt-1 text-[#52655d]">{value}</dd></div>; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString("zh-TW") : "尚無紀錄"; }

function ImportActions({ item, stories, busy, onAction }: { item: ImportRow; stories: StoryOption[]; busy: boolean; onAction: (action: string, postId?: string, extra?: Record<string, string>) => Promise<void> }) {
  const [targetStoryId, setTargetStoryId] = useState(item.possible_duplicate_story_id || "");
  return <div className="flex max-w-xl flex-wrap items-center justify-end gap-3">
    {item.possible_duplicate_story_id && <span className="rounded-full bg-[#fff1ee] px-3 py-1 text-xs text-[#9a4d42]">疑似已有文章，請確認</span>}
    {item.source_permalink && <a href={item.source_permalink} target="_blank" rel="noreferrer" className="text-sm text-[#557166]">查看原文</a>}
    {(item.status === "failed" || item.status === "needs_attention") && <button disabled={busy} onClick={() => onAction("retry", item.post_id)} className="text-sm text-[#c1664b]">重新嘗試</button>}
    {item.status === "update_pending" && <button disabled={busy} onClick={() => onAction("apply_latest", item.post_id)} className="text-sm text-[#c1664b]">套用最新內容</button>}
    <select aria-label={`連結 ${item.post_id} 到既有文章`} value={targetStoryId} onChange={(event) => setTargetStoryId(event.target.value)} className="max-w-56 rounded-lg border px-2 py-2 text-xs"><option value="">連結到既有文章…</option>{stories.filter((story) => story.id !== item.story_id).map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}</select>
    <button disabled={busy || !targetStoryId} onClick={() => onAction("link_existing", undefined, { importId: item.id, storyId: targetStoryId })} className="text-sm text-[#c1664b] disabled:opacity-40">確認連結</button>
  </div>;
}
