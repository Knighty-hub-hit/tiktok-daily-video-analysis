import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TikTok 每日视频分析台",
  description: "按每日导出视频链接整理、排序和拆解 TikTok 带货视频。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
