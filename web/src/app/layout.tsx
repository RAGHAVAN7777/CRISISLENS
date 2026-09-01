import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import StorageInit from "@/components/StorageInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Disaster Intelligence Network",
  description: "AI-Powered Multi-Channel Disaster Intelligence & Dynamic Routing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex h-screen bg-zinc-950 text-zinc-100`}
      >
        <StorageInit />
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-zinc-900">
          {children}
        </main>
      </body>
    </html>
  );
}
