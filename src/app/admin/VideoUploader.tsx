"use client";

import { ChangeEvent, useEffect, useState } from "react";

export default function VideoUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("尚未選擇影片");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setMessage(`${selected.name} · ${(selected.size / 1024 / 1024).toFixed(1)} MB`);
  }

  function uploadVideo() {
    setMessage(file ? "展示模式：設定 Cloudflare Stream 後即可開始直接上傳" : "請先選擇影片");
  }

  return <section className="mt-8 rounded-3xl bg-[#f5f7f3] p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-[#31413d]">影片</h2><p className="mt-1 text-sm text-[#7a8b83]">影片會同時出現在文章與影片專區。</p></div><label className="cursor-pointer rounded-full bg-[#e5eee7] px-4 py-2 text-sm text-[#557166] hover:bg-[#d8e8dc]">選擇影片<input type="file" accept="video/*" className="hidden" onChange={selectVideo} /></label></div>{preview && <div className="mt-5 overflow-hidden rounded-2xl bg-[#31413d]"><video src={preview} controls className="max-h-80 w-full" /></div>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><input placeholder="影片標題" className="rounded-xl border border-[#dce5de] bg-white px-4 py-3 text-sm outline-none focus:border-[#c1664b]" /><input placeholder="影片說明" className="rounded-xl border border-[#dce5de] bg-white px-4 py-3 text-sm outline-none focus:border-[#c1664b]" /><input placeholder="國家／城市／景點" className="rounded-xl border border-[#dce5de] bg-white px-4 py-3 text-sm outline-none focus:border-[#c1664b]" /><input type="text" placeholder="自訂封面圖片網址（之後可改為上傳）" className="rounded-xl border border-[#dce5de] bg-white px-4 py-3 text-sm outline-none focus:border-[#c1664b]" /></div><div className="mt-4 flex items-center justify-between gap-4"><span className="text-xs text-[#7a8b83]">{message}</span><button onClick={uploadVideo} disabled={!file} className="rounded-full bg-[#c1664b] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">上傳影片</button></div></section>;
}
