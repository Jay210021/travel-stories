"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicNavbar from "./PublicNavbar";

type Story = { slug: string; title: string; body: string; category: string; country: string | null; city: string | null; published_at: string | null };
const categories = ["全部", "國外旅行", "台灣旅行", "日常生活"];

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");

  useEffect(() => {
    fetch("/api/published-stories")
      .then((response) => { if (!response.ok) throw new Error("Failed to load published stories"); return response.json(); })
      .then((data) => setStories(data.stories ?? []))
      .catch(() => setStories([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const readQuery = () => setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    const receiveNavbarSearch = (event: Event) => setQuery((event as CustomEvent<string>).detail);
    readQuery();
    window.addEventListener("popstate", readQuery);
    window.addEventListener("title-search", receiveNavbarSearch);
    return () => {
      window.removeEventListener("popstate", readQuery);
      window.removeEventListener("title-search", receiveNavbarSearch);
    };
  }, []);

  const visible = useMemo(() => stories.filter((story) => (category === "全部" || story.category === category) && story.title.toLowerCase().includes(query.trim().toLowerCase())), [stories, query, category]);

  return <main className="min-h-screen bg-[#fdfcf8] text-[#31413d]"><PublicNavbar /><header className="mx-auto max-w-6xl px-6 pb-16 pt-16"><p className="text-sm tracking-[0.25em] text-[#c1664b]">OUR TRAVEL ARCHIVE</p><h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight sm:text-7xl">把一起走過的路，寫成故事。</h1><p className="mt-6 max-w-xl text-lg leading-8 text-[#687a73]">記錄我們的旅行、生活，以及那些值得回頭看的日子。</p></header><section id="stories" className="mx-auto max-w-6xl px-6 pb-24"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex flex-wrap gap-2">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-sm ${category === item ? "bg-[#c1664b] text-white" : "bg-[#eaf0eb] text-[#587067]"}`}>{item}</button>)}</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋國家、城市或文章" className="rounded-full border border-[#d3dfd8] px-4 py-2 text-sm outline-none" /></div>{isLoading ? <p className="mt-10 text-center text-[#718078]">文章載入中…</p> : <><div className="mt-10 grid gap-8 md:grid-cols-3">{visible.map((story) => <article key={story.slug} className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs text-[#c1664b]">{story.category}{story.country ? ` · ${story.country}` : ""}</p><h2 className="mt-3 text-2xl font-semibold"><Link href={`/stories/${story.slug}`} className="hover:text-[#c1664b]">{story.title}</Link></h2><p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-7 text-[#718078]">{story.body}</p></article>)}</div>{visible.length === 0 && <p className="mt-10 text-center text-[#718078]">目前沒有符合的文章。</p>}</>}</section></main>;
}
