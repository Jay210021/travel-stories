"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Event = { id: number; source_id: string | null; action: string; actor_email: string | null; created_at: string };
const labels: Record<string, string> = { created: "建立", updated: "修改", published: "發布", unpublished: "取消發布", trashed: "移至垃圾桶", restored: "復原" };

export default function RecentActivity() {
  const [events, setEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState("載入中…");
  useEffect(() => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) return;
    supabase.from("content_events").select("id,source_id,action,actor_email,created_at").order("created_at", { ascending: false }).limit(6).then(({ data, error }) => {
      setEvents((data ?? []) as Event[]); setMessage(error ? "執行 005 migration 後會顯示紀錄。" : "");
    });
  }, []);
  return <section className="rounded-3xl bg-white p-6"><p className="text-sm font-medium text-[#52655d]">最近操作</p><div className="mt-4 space-y-3">{events.map((event) => <div key={event.id} className="text-xs leading-5 text-[#7a8b83]"><span className="font-medium text-[#c1664b]">{labels[event.action] ?? event.action}</span> {event.source_id ?? "文章"}<span className="block text-[#9aa8a0]">{event.actor_email ?? "系統"} · {new Date(event.created_at).toLocaleString("zh-TW")}</span></div>)}{message && <p className="text-xs text-[#9aa8a0]">{message}</p>}{!events.length && !message && <p className="text-xs text-[#9aa8a0]">尚無操作紀錄。</p>}</div></section>;
}
