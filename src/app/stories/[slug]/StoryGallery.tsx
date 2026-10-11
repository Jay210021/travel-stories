"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type TouchEvent } from "react";

type Photo = { storage_path: string; url: string; alt_text: string; caption: string };

export default function StoryGallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState(0);
  const [view, setView] = useState<"full" | "all" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const thumbnails = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const count = photos.length;
  const photo = photos[active];
  const isOpen = view !== null;

  useEffect(() => {
    const node = dialog.current;
    if (!isOpen || !node) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const strip = thumbnails.current;
    const item = strip?.children[active] as HTMLElement | undefined;
    if (strip && item) strip.scrollTo({ left: item.offsetLeft - strip.offsetLeft - (strip.clientWidth - item.clientWidth) / 2, behavior: "smooth" });
  }, [active]);

  if (!photo) return null;
  function move(direction: number) { setActive((index) => (index + direction + count) % count); }
  function startTouch(event: TouchEvent) {
    swiped.current = false;
    if (event.touches.length !== 1) { touch.current = null; return; }
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  function endTouch(event: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || !event.changedTouches[0]) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (count > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swiped.current = true;
      move(dx < 0 ? 1 : -1);
    }
  }
  function stage(full: boolean) {
    return <div className={`relative flex items-center justify-center overflow-hidden ${full ? "h-[70dvh] bg-[#18231f]" : "aspect-[4/3] max-h-[65vh] rounded-3xl bg-[#eaf0eb] sm:aspect-[16/10]"}`}>
      <button type="button" aria-label={full ? "目前照片" : "全螢幕檢視照片"} className="h-full w-full touch-pan-y" onTouchStart={startTouch} onTouchMove={(event) => { if (event.touches.length > 1) touch.current = null; }} onTouchEnd={endTouch} onTouchCancel={() => { touch.current = null; }} onClick={() => { if (swiped.current) { swiped.current = false; return; } if (!full) setView("full"); }}>
        <img src={photo.url} alt={photo.alt_text || `旅行照片 ${active + 1}`} draggable={false} className="h-full w-full object-contain" fetchPriority={active === 0 ? "high" : "auto"} />
      </button>
      {count > 1 && <><button type="button" aria-label="上一張照片" onClick={() => move(-1)} className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-[#31413d] shadow sm:left-4">‹</button><button type="button" aria-label="下一張照片" onClick={() => move(1)} className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-[#31413d] shadow sm:right-4">›</button></>}
      <span aria-live="polite" aria-atomic="true" className="pointer-events-none absolute bottom-3 right-4 rounded-full bg-black/55 px-3 py-1 text-xs tabular-nums text-white">{active + 1}／{count}</span>
    </div>;
  }
  return <section aria-label="文章相簿" aria-roledescription="輪播相簿" className="mx-auto mt-10 max-w-4xl" onKeyDown={(event) => { if (view === "all") return; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}>
    {stage(false)}
    <div className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm text-[#64776d]"><p>{photo.caption || (count > 1 ? "左右滑動看照片，點照片可放大" : "點照片可放大")}</p><button type="button" onClick={() => setView("all")} className="shrink-0 rounded-full border border-[#cbd9d1] px-4 py-2 text-[#557166]">查看全部 {count} 張</button></div>
    {count > 1 && <div ref={thumbnails} aria-label="照片縮圖" className="relative flex gap-2 overflow-x-auto pb-3">
      {photos.map((item, index) => <button type="button" key={item.storage_path} aria-label={`查看第 ${index + 1} 張照片`} aria-pressed={active === index} onClick={() => setActive(index)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 p-0.5 sm:h-20 sm:w-24 ${active === index ? "border-[#c1664b]" : "border-transparent opacity-65 hover:opacity-100"}`}><img src={item.url} alt="" loading="lazy" className="h-full w-full rounded-lg object-cover" /></button>)}
    </div>}
    <dialog ref={dialog} aria-label={view === "all" ? "全部照片" : "全螢幕照片"} onCancel={() => setView(null)} onClose={() => setView(null)} onClick={(event) => { if (event.target === event.currentTarget) setView(null); }} className="fixed inset-0 m-auto max-h-[100dvh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#18231f] p-0 text-white backdrop:bg-black/80">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[#18231f] px-5 py-4"><h2 className="font-medium">{view === "all" ? `全部照片 · ${count} 張` : `旅行相簿 · ${active + 1}／${count}`}</h2><div className="flex gap-3">{view === "full" && <button type="button" onClick={() => setView("all")} className="rounded-full border border-white/30 px-4 py-2 text-sm">照片總覽</button>}<button type="button" autoFocus onClick={() => setView(null)} className="rounded-full bg-white/15 px-4 py-2 text-sm">關閉</button></div></div>
      {view === "full" && <>{stage(true)}<p className="min-h-12 px-5 py-3 text-center text-sm text-white/80">{photo.caption}</p></>}
      {view === "all" && <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">{photos.map((item, index) => <button type="button" key={item.storage_path} aria-label={`放大第 ${index + 1} 張照片`} onClick={() => { setActive(index); setView("full"); }} className="relative aspect-square overflow-hidden rounded-xl bg-white/10"><img src={item.url} alt={item.alt_text || `旅行照片 ${index + 1}`} loading="lazy" className="h-full w-full object-cover" /><span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs">{index + 1}</span></button>)}</div>}
    </dialog>
  </section>;
}
