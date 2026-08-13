"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { PulseMark } from "@/components/icons/PulseMark";

// Below the `md` breakpoint the sidebar (components/layout/Sidebar.tsx) is
// hidden and lives in a slide-over drawer instead — this bar is what's
// always visible on a phone: the brand mark plus the button that opens it.
export function MobileTopBar({ onOpenMenu }: Readonly<{ onOpenMenu: () => void }>) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <PulseMark className="h-7 w-7" />
        <span className="font-display text-sm font-medium">Ilazdoot</span>
      </Link>
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border text-text hover:border-primary"
      >
        <Menu className="h-4 w-4" />
      </button>
    </header>
  );
}
