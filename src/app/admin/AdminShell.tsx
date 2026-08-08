"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const navigation = [
  { href: "/admin", label: "新增文章", symbol: "+" },
  { href: "/admin/drafts", label: "草稿與文章", symbol: "▤" },
  { href: "/admin/import-preview", label: "Facebook 匯入", symbol: "↓" },
  { href: "/admin/analytics", label: "閱讀統計", symbol: "↗" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState("作者後台");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setAuthor(data.user.email);
    });
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/admin");
    router.refresh();
  }

  const sidebar = <div className="flex h-full flex-col">
    <div className="border-b border-white/10 px-6 py-7"><p className="text-xs tracking-[0.22em] text-[#efb08d]">AUTHOR SPACE</p><p className="mt-2 text-lg font-semibold tracking-[0.08em] text-white">天天寶寶</p></div>
    <nav className="flex-1 space-y-2 px-3 py-6" aria-label="作者後台導覽">{navigation.map((item) => { const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${active ? "bg-white text-[#31413d] shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c1664b]/15 text-base text-[#efb08d]">{item.symbol}</span>{item.label}</Link>; })}</nav>
    <div className="space-y-3 border-t border-white/10 p-4"><p className="truncate px-2 text-xs text-white/45" title={author}>{author}</p><Link href="/" className="block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">← 返回公開網站</Link><button type="button" onClick={signOut} className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white">登出</button></div>
  </div>;

  return <div className="min-h-screen bg-[#f5f7f3] lg:grid lg:grid-cols-[260px_1fr]">
    <aside className="sticky top-0 hidden h-screen bg-[#31413d] lg:block">{sidebar}</aside>
    <div className="min-w-0"><header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#dce5de] bg-[#f5f7f3]/95 px-5 py-4 backdrop-blur lg:hidden"><Link href="/admin" className="font-semibold tracking-[0.08em] text-[#31413d]">天天寶寶・作者後台</Link><button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-mobile-navigation" className="rounded-full border border-[#cbd9d1] px-4 py-2 text-sm text-[#557166]">選單</button></header>{children}</div>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="關閉選單" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/35" /><aside id="admin-mobile-navigation" className="absolute right-0 top-0 h-full w-[min(85vw,320px)] bg-[#31413d] shadow-2xl"><button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-5 z-10 rounded-full px-3 py-2 text-sm text-white/70">關閉</button>{sidebar}</aside></div>}
  </div>;
}
