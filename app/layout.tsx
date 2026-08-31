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
  title: "Apollo Solar | Your roof. Your savings.",
  description: "See your home's estimated solar generation and possible electricity bill reduction in under 60 seconds.",
  openGraph: {
    title: "Apollo Solar | See what your roof could save you.",
    description: "Estimate your roof's yearly solar generation and possible electricity bill reduction — in under 60 seconds.",
    images: [{ url: "/og.png", width: 1731, height: 907, alt: "Apollo Solar roof savings assessment" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apollo Solar | See what your roof could save you.",
    description: "Estimate your roof's yearly solar generation and possible electricity bill reduction — in under 60 seconds.",
    images: ["/og.png"],
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
