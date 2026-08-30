import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nlp/NavBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OmniText — Practical Text Intelligence & NLP Platform",
  description: "Seven focused NLP capabilities backed by rigorous model benchmarking and transparent evaluation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} min-h-screen bg-canvas text-text-primary antialiased flex flex-col`}>
        <NavBar />
        <div className="flex-1 flex flex-col w-full">
          {children}
        </div>
      </body>
    </html>
  );
}
