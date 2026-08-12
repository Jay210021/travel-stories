"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PublicNavbar from "./PublicNavbar";

type Story = { slug: string; title: string; body: string; classification_labels: string[] };

export default function Home() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

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
    const resetHome = () => setQuery("");
    readQuery();
    window.addEventListener("popstate", readQuery);
    window.addEventListener("title-search", receiveNavbarSearch);
    window.addEventListener("home-reset", resetHome);
    return () => {
      window.removeEventListener("popstate", readQuery);
      window.removeEventListener("title-search", receiveNavbarSearch);
      window.removeEventListener("home-reset", resetHome);
    };
  }, []);

  const visible = useMemo(
    () => stories.filter((story) => story.title.toLowerCase().includes(query.trim().toLowerCase())),
    [stories, query],
  );

  return (
    <main className="min-h-screen bg-[#fdfcf8] text-[#31413d]">
      <PublicNavbar />
      <header className="mx-auto max-w-6xl px-6 pb-16 pt-16">
        <p className="text-sm tracking-[0.25em] text-[#c1664b]">OUR TRAVEL ARCHIVE</p>
        <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight sm:text-7xl">把一起走過的路，寫成故事。</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#687a73]">記錄我們的旅行、生活，以及那些值得回頭看的日子。</p>
      </header>
      <section id="stories" className="mx-auto max-w-6xl px-6 pb-24">
        {isLoading ? (
          <p className="text-center text-[#718078]">文章載入中…</p>
        ) : (
          <>
            <div className="grid gap-8 md:grid-cols-3">
              {visible.map((story) => (
                <article key={story.slug} className="rounded-3xl bg-white p-6 shadow-sm">
                  <p className="text-xs text-[#c1664b]">{story.classification_labels.join(" · ")}</p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    <Link href={`/stories/${story.slug}`} className="hover:text-[#c1664b]">{story.title}</Link>
                  </h2>
                  <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-7 text-[#718078]">{story.body}</p>
                </article>
              ))}
            </div>
            {visible.length === 0 && <p className="mt-10 text-center text-[#718078]">目前沒有符合的文章。</p>}
          </>
        )}
      </section>
    </main>
  );
}
