"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PulseMark } from "@/components/icons/PulseMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Patients" },
];

// Shared top bar for every signed-in page. A real sidebar shell lands in
// Phase 10 — this is still the plain-but-consistent version.
export function AppHeader() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 md:px-10">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <PulseMark className="h-7 w-7" />
          <span className="font-display text-base font-medium">PG Appointment Tracker</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "font-medium text-primary" : "text-muted hover:text-text"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm text-text hover:border-primary"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
