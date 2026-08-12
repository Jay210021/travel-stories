import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天天寶寶旅行趣｜我們的旅行故事",
  description: "收藏天天寶寶一起走過的旅行、生活與成長故事。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
