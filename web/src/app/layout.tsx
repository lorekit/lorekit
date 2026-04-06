import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel, Cinzel_Decorative } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const cinzelDeco = Cinzel_Decorative({
  variable: "--font-logo-deco",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "LoreKit — AI Video That Drives Revenue",
  description:
    "AI-powered video for brands that measure results. Generate ads, content, and stories that convert. Open-source AI video studio.",
  keywords: [
    "AI video ads",
    "AI video generation",
    "video ad creator",
    "AI content creation",
    "open source video studio",
    "brand video",
    "video marketing",
    "AI ad generator",
  ],
  openGraph: {
    title: "LoreKit — Video That Drives Revenue",
    description:
      "AI-powered video for brands that measure results. Rapidly generate ads, content, and stories that convert. Scale what works.",
    type: "website",
    siteName: "LoreKit",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoreKit — Video That Drives Revenue",
    description:
      "AI-powered video for brands that measure results. Rapidly generate ads, content, and stories that convert. Scale what works.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${cinzelDeco.variable} h-full`}>
      <head>
        <link rel="stylesheet" href="/fonts/overlay-fonts.css" />
      </head>
      <body className="h-full bg-slate-950 text-slate-300 antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
