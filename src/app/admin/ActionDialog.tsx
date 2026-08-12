"use client";

import { useEffect, useId, useRef } from "react";

type ActionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
  tone?: "default" | "success" | "error";
  busy?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
};

export default function ActionDialog({ open, title, description, primaryLabel, secondaryLabel, tone = "default", busy = false, onPrimary, onSecondary }: ActionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) (onSecondary ?? onPrimary)();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onPrimary, onSecondary, open]);

  if (!open) return null;
  const icon = tone === "success" ? "✓" : tone === "error" ? "!" : "?";
  const iconClass = tone === "success" ? "bg-[#e4f2e7] text-[#3f7650]" : tone === "error" ? "bg-[#f8e6e2] text-[#a14f43]" : "bg-[#fff0e8] text-[#c1664b]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1e2926]/45 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) (onSecondary ?? onPrimary)(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-md rounded-3xl bg-[#fdfcf8] p-7 shadow-2xl sm:p-8">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-semibold ${iconClass}`}>{icon}</div>
        <h2 id={titleId} className="mt-5 text-2xl font-semibold text-[#31413d]">{title}</h2>
        <p id={descriptionId} className="mt-3 whitespace-pre-line leading-7 text-[#718078]">{description}</p>
        <div className="mt-7 flex justify-end gap-3">
          {secondaryLabel && <button type="button" onClick={onSecondary} disabled={busy} className="rounded-full border border-[#cbd9d1] px-5 py-2.5 text-sm text-[#557166] disabled:opacity-50">{secondaryLabel}</button>}
          <button ref={primaryRef} type="button" onClick={onPrimary} disabled={busy} className={`rounded-full px-5 py-2.5 text-sm text-white disabled:opacity-50 ${tone === "error" ? "bg-[#a14f43]" : "bg-[#c1664b]"}`}>{busy ? "處理中…" : primaryLabel}</button>
        </div>
      </section>
    </div>
  );
}
