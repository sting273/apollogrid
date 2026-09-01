import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "APOLLOGRID | Your roof. Your savings.",
  description: "See your home's estimated solar generation and possible electricity bill reduction in under 60 seconds.",
  openGraph: {
    title: "APOLLOGRID | See what your roof could save you.",
    description: "Estimate your roof's yearly solar generation and possible electricity bill reduction — in under 60 seconds.",
    images: [{ url: "https://apollo-solar-assessment.guoyiding273.chatgpt.site/og.png", width: 1200, height: 630, alt: "APOLLOGRID roof savings assessment" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "APOLLOGRID | See what your roof could save you.",
    description: "Estimate your roof's yearly solar generation and possible electricity bill reduction — in under 60 seconds.",
    images: ["https://apollo-solar-assessment.guoyiding273.chatgpt.site/og.png"],
  },
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
