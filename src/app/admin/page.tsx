"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import PhotoUploader from "./PhotoUploader";
import VideoUploader from "./VideoUploader";
import ContentSafety from "./ContentSafety";

const categories = ["國外旅行", "台灣旅行", "日常生活"];

export default function AdminPage() {
  const [mode, setMode] = useState<"login" | "editor">("login");
  const [status, setStatus] = useState("尚未登入");
  const [saved, setSaved] = useState(false);

  async function signIn() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("目前是展示模式：設定 Supabase 環境變數後即可使用 Google 登入");
      setMode("editor");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setStatus(error.message);
  }

  if (mode === "login") return <main className="min-h-screen bg-[#fdfcf8] px-6 py-8"><nav className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><span className="text-sm text-[#7a8b83]">作者後台</span></nav><section className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center"><p className="text-sm tracking-[0.2em] text-[#c1664b]">AUTHOR SPACE</p><h1 className="mt-3 text-4xl font-semibold text-[#31413d]">把下一段故事寫下來。</h1><p className="mt-5 leading-7 text-[#718078]">只有兩位作者可以進入後台，訪客不需要登入。</p><button onClick={signIn} className="mt-8 rounded-full bg-[#c1664b] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#c1664b]/20 transition hover:bg-[#ad533e]">使用 Google 登入</button><p className="mt-4 text-xs leading-5 text-[#9aa8a0]">{status}</p></section></main>;

  return <main className="min-h-screen bg-[#f5f7f3] px-6 py-8"><nav className="mx-auto flex max-w-5xl justify-between"><Link href="/" className="text-lg font-semibold tracking-[0.16em] text-[#31413d]">天天寶寶旅行趣</Link><span className="rounded-full bg-[#e5eee7] px-4 py-2 text-xs text-[#557166]">展示模式</span></nav><section className="mx-auto max-w-5xl py-12"><p className="text-sm tracking-[0.2em] text-[#c1664b]">AUTHOR SPACE</p><div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold text-[#31413d]">寫一篇新的故事</h1><p className="mt-3 text-[#718078]">先存成草稿，確認後再公開。</p></div><span className="text-sm text-[#7a8b83]">{status}</span></div><div className="mt-10 grid gap-8 lg:grid-cols-[1fr_280px]"><div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><label className="block text-sm font-medium text-[#52655d]">文章標題<input className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3 text-lg outline-none focus:border-[#c1664b]" placeholder="例如：在米蘭大教堂，遇見一場細雨" /></label><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-[#52655d]">文章分類<select className="mt-2 w-full rounded-xl border border-[#dce5de] bg-white px-4 py-3"><option>{categories[0]}</option>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm font-medium text-[#52655d]">發布日期<input type="date" className="mt-2 w-full rounded-xl border border-[#dce5de] px-4 py-3" /></label></div><label className="mt-6 block text-sm font-medium text-[#52655d]">故事內容<textarea className="mt-2 min-h-64 w-full rounded-xl border border-[#dce5de] px-4 py-3 leading-7 outline-none focus:border-[#c1664b]" placeholder="寫下這趟旅程裡最想留下的片段⋯" /></label><PhotoUploader /><VideoUploader /><div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={() => setSaved(true)} className="rounded-full border border-[#cbd9d1] px-5 py-3 text-sm text-[#557166]">儲存草稿</button><button className="rounded-full bg-[#c1664b] px-5 py-3 text-sm text-white">預覽文章</button></div>{saved && <p className="mt-4 text-right text-sm text-[#648276]">草稿已暫存（展示模式）</p>}</div><aside className="space-y-4"><ContentSafety /><div className="rounded-3xl bg-white p-6"><p className="text-sm font-medium text-[#52655d]">下一步</p><ul className="mt-3 space-y-3 text-sm leading-6 text-[#7a8b83]"><li>○ 設定 Supabase 資料庫</li><li>○ 連接 Email 通知服務</li><li>○ 補上實際備份排程</li></ul></div></aside></div></section></main>;
}
