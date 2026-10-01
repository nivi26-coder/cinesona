import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: { default: "Cinesona", template: "%s · Cinesona" },
  description: "Find your next movie, series, anime or game by title, plot, cast or vibe.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border">
          <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Cine<span className="text-accent">sona</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs leading-5 text-muted">
          <p>
            Data from the MongoDB Atlas <code className="font-mono">sample_mflix</code> dataset,{" "}
            <a href="https://www.themoviedb.org" className="underline hover:text-accent">
              TMDB
            </a>
            ,{" "}
            <a href="https://anilist.co" className="underline hover:text-accent">
              AniList
            </a>{" "}
            and{" "}
            <a href="https://www.igdb.com" className="underline hover:text-accent">
              IGDB
            </a>
            .
          </p>
          {/* Wording required by the TMDB API terms. */}
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </footer>
      </body>
    </html>
  );
}
