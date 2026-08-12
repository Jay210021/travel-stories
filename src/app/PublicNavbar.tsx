"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import type { PublicNavbarItem } from "@/lib/navbar-types";
import { getSupabaseBrowserClient, isCurrentUserAuthor } from "@/lib/supabase-browser";

export default function PublicNavbar() {
  const pathname = usePathname(); const router = useRouter();
  const [items, setItems] = useState<PublicNavbarItem[]>([]); const [query, setQuery] = useState(""); const [mobileOpen, setMobileOpen] = useState(false); const [isAuthor, setIsAuthor] = useState(false);
  useEffect(() => { fetch("/api/navigation").then((response) => response.ok ? response.json() : { items: [] }).then((data) => Array.isArray(data.items) && setItems(data.items)).catch(() => undefined); isCurrentUserAuthor().then(setIsAuthor).catch(() => undefined); const syncQuery = () => setQuery(new URLSearchParams(window.location.search).get("q") ?? ""); syncQuery(); window.addEventListener("popstate", syncQuery); return () => window.removeEventListener("popstate", syncQuery); }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const body = document.body;
    const root = document.documentElement;
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow, overscroll: root.style.overscrollBehavior };
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    let locked = false;
    let lockedScrollY = window.scrollY;
    const lock = () => {
      if (locked) return;
      lockedScrollY = window.scrollY;
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
      locked = true;
    };
    const unlock = () => {
      if (!locked) return;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overscrollBehavior = previous.overscroll;
      locked = false;
      window.scrollTo(0, lockedScrollY);
    };
    const syncBodyScroll = () => { if (mobileQuery.matches) lock(); else unlock(); };
    syncBodyScroll();
    mobileQuery.addEventListener("change", syncBodyScroll);
    return () => { mobileQuery.removeEventListener("change", syncBodyScroll); unlock(); };
  }, [mobileOpen]);
  function close() { setMobileOpen(false); }
  function scrollToStories() { window.requestAnimationFrame(() => document.getElementById("stories")?.scrollIntoView({ behavior: "smooth", block: "start" })); }
  function search(event: FormEvent) { event.preventDefault(); const value = query.trim(); const href = value ? `/?q=${encodeURIComponent(value)}#stories` : "/#stories"; window.dispatchEvent(new CustomEvent("title-search", { detail: value })); router.push(href); close(); scrollToStories(); }
  function goHome(event: MouseEvent<HTMLAnchorElement>) { event.preventDefault(); setQuery(""); close(); window.dispatchEvent(new Event("home-reset")); if (pathname === "/") { window.history.pushState(null, "", "/"); window.scrollTo({ top: 0, behavior: "smooth" }); } else router.push("/"); }
  async function authorArea() { if (isAuthor) return router.push("/admin"); const supabase = getSupabaseBrowserClient(); if (!supabase) return router.push("/admin"); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (error) router.push("/admin"); }
  const searchForm = (mobile = false) => <form onSubmit={search} className={mobile ? "flex gap-2" : "ml-3 flex items-center"}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋標題" aria-label="搜尋文章標題" className={`${mobile ? "min-w-0 flex-1" : "w-32 lg:w-40"} rounded-full border border-[#d3dfd8] bg-white px-3 py-2 text-sm outline-none`} /><button className="rounded-full bg-[#c1664b] px-3 py-2 text-sm text-white">搜尋</button></form>;
  const target = (item: PublicNavbarItem) => item.type === "destination" ? `/regions/${item.region.slug}` : item.href;
  const children = (item: PublicNavbarItem) => item.type === "destination" ? item.region.countries.map((country) => ({ id: country.slug, label: country.label, href: `/regions/${item.region.slug}/${country.slug}` })) : item.type === "group" ? item.children : [];
  const desktopItem = (item: PublicNavbarItem) => { const href = target(item); const subitems = children(item); if (!subitems.length) return <Link key={item.id} href={href} className={`px-2 text-sm lg:px-4 ${pathname === href ? "text-[#c1664b]" : "text-[#52655d] hover:text-[#c1664b]"}`}>{item.label}</Link>; return <div key={item.id} className="group relative flex h-full items-center"><Link href={href} className={`flex h-full items-center gap-1 px-2 text-sm lg:px-4 ${pathname.startsWith(href) ? "text-[#c1664b]" : "text-[#52655d] hover:text-[#c1664b]"}`}>{item.label}<span className="text-xs">⌄</span></Link><div className="invisible absolute left-1/2 top-full w-64 -translate-x-1/2 translate-y-2 rounded-2xl border border-[#e1e8e2] bg-white p-3 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"><Link href={href} className="block rounded-xl px-3 py-2 text-sm font-medium text-[#31413d] hover:bg-[#f3f6f3]">查看所有{item.label}文章</Link><div className="my-2 border-t border-[#edf1ed]" />{subitems.map((child) => <Link key={child.id} href={child.href} className="block rounded-xl px-3 py-2 text-sm text-[#64776d] hover:bg-[#f3f6f3] hover:text-[#c1664b]">{child.label}</Link>)}</div></div>; };
  return <header className="sticky top-0 z-40 border-b border-[#e4eae5]"><div className="bg-[#fdfcf8]/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6"><Link href="/" onClick={goHome} className="text-base font-semibold tracking-[0.14em] text-[#31413d] sm:text-lg">天天寶寶旅行趣</Link><nav className="hidden h-full items-center md:flex" aria-label="主要導覽">{items.map(desktopItem)}{searchForm()}<button type="button" onClick={() => void authorArea()} className="ml-3 rounded-full border border-[#c1664b] px-3 py-2 text-sm text-[#c1664b]">{isAuthor ? "進入後台" : "管理者登入"}</button></nav><button type="button" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-controls="mobile-navigation" className="rounded-full border px-4 py-2 text-sm md:hidden">{mobileOpen ? "關閉" : "選單"}</button></div></div>{mobileOpen && <nav id="mobile-navigation" aria-label="手機版主要導覽" className="fixed inset-x-0 bottom-0 top-16 touch-pan-y overflow-y-auto overscroll-contain border-t bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:hidden">{searchForm(true)}<div className="mt-3">{items.map((item) => <div key={item.id} className="border-b py-1"><Link href={target(item)} onClick={close} className="block py-3 font-medium">{item.label}</Link>{children(item).map((child) => <Link key={child.id} href={child.href} onClick={close} className="block py-2 pl-4 text-sm text-[#64776d]">{child.label}</Link>)}</div>)}</div><button type="button" onClick={() => void authorArea()} className="mt-4 w-full rounded-xl border border-[#c1664b] px-4 py-3 text-sm text-[#c1664b]">{isAuthor ? "進入後台" : "管理者登入"}</button></nav>}</header>;
}
