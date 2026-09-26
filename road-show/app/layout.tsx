import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Road Show Experiment · 现场实验",
  description: "路演现场计数、步骤补录、云端保存与 Excel 导出",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
