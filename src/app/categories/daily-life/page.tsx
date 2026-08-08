import Breadcrumbs from "@/app/Breadcrumbs";
import PublicNavbar from "@/app/PublicNavbar";
import StoryCollection from "@/app/StoryCollection";
import { listStoriesForCategory } from "@/lib/public-reading";

export default async function DailyLifePage() {
  const stories = await listStoriesForCategory("日常生活");
  return <main className="min-h-screen bg-[#fdfcf8]"><PublicNavbar /><section className="mx-auto max-w-6xl px-6 py-10"><Breadcrumbs items={[{ label: "首頁", href: "/" }, { label: "日常生活" }]} /><p className="mt-14 text-sm tracking-[0.2em] text-[#c1664b]">DAILY NOTES</p><h1 className="mt-3 text-5xl font-semibold text-[#31413d]">日常生活</h1><StoryCollection stories={stories} /></section></main>;
}
