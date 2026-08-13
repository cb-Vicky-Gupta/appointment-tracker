import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Heading font — paired deliberately against the plain Geist body font
// (PRD Reference G: an unusual, non-Inter-both pairing is one of the cheapest
// ways to stop looking like a generic AI-generated SaaS template).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Ilazdoot",
  description: "A private patient appointment log for PG residents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // "other-light" is the pre-session default; ThemeProvider corrects it
      // to the real gender+mode combo as soon as the session/localStorage
      // resolves client-side (see lib/theme-context.tsx).
      data-theme="other-light"
      // `dvh`, not `vh`/`h-full`, on both html and body: on a phone the URL
      // bar makes 100vh taller than what's actually visible, so a `100vh`
      // page hangs its bottom edge under the browser chrome. That's what was
      // pushing the sidebar's logout button below the fold (AppShell already
      // sized itself in `dvh` — it was this ancestor forcing it back to vh).
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} min-h-dvh antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-text">
        <AuthProvider>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
