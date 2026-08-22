import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "CodeDuel — Competitive coding",
  description: "Competitive Python coding matches and focused solo practice.",
};

/**
 * Required by the nonce-based CSP in `src/proxy.ts`.
 *
 * A nonce only exists once there is a request to attach it to. A statically
 * prerendered page is built before any request exists, so its inline scripts carry
 * no nonce and the browser blocks them, which stops React hydrating. Every page here
 * is a client component fetching at runtime anyway, so static rendering was buying
 * nothing. This is the only place the setting can live: the pages themselves are all
 * `"use client"` and cannot export route segment config.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}<ThemeToggle /></body>
    </html>
  );
}
