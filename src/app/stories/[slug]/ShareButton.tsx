"use client";

import { useState } from "react";

export default function ShareButton() {
  const [label, setLabel] = useState("複製文章連結");
  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setLabel("已複製連結 ✓");
    window.setTimeout(() => setLabel("複製文章連結"), 1800);
  }
  return <button onClick={copyLink} className="rounded-full border border-[#d3dfd8] px-4 py-2 text-sm text-[#557166] transition hover:border-[#c1664b] hover:text-[#c1664b]">{label}</button>;
}
