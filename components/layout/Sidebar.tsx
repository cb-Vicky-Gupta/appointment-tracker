"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PulseMark } from "@/components/icons/PulseMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ADMIN_NAV_LINKS, type NavLink } from "@/components/layout/nav-links";

// The Phase 10 sidebar shell (PRD Reference G: sidebar-based dashboard
// instead of a top-nav-only layout), generalized in Plan Phase C to also
// back the admin panel's sidebar — `navLinks`/`homeHref` are what differ
// between the two (components/layout/nav-links.tsx), everything else about
// the shell (collapse, mobile drawer, logout) is shared via AppShell.
//
// An ADMIN-role account always gets ADMIN_NAV_LINKS here, regardless of
// which `navLinks` its layout passed in — an admin isn't assumed to also be
// a PG resident, so it never sees Dashboard/Patients (app/(dashboard)/layout.tsx
// also redirects an admin away from those routes outright, this is just the
// nav reflecting that same rule).
//
// Rendered twice per AppShell mount — once pinned in the desktop `<aside>`,
// once inside the mobile slide-over drawer — so it takes an optional
// `onNavigate` to close that drawer after a link/logout click; the desktop
// sidebar simply never passes one. `collapsed`/`onToggleCollapse` are
// desktop-only too — the mobile drawer never passes them, so it always
// renders fully expanded (there's no shared-with-content width to save there).
export function Sidebar({
  navLinks,
  homeHref,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: Readonly<{
  navLinks: NavLink[];
  homeHref: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}>) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    onNavigate?.();
    router.push("/login");
  }

  const links = user?.role === "ADMIN" ? ADMIN_NAV_LINKS : navLinks;
  const effectiveHomeHref = user?.role === "ADMIN" ? "/admin" : homeHref;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 py-5">
        <Link
          href={effectiveHomeHref}
          onClick={onNavigate}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <PulseMark className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <span className="font-display truncate text-base font-medium leading-tight">Ilazdoot</span>
          )}
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-text"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* `min-h-0` is what actually lets this shrink: a flex item's default
          `min-height: auto` means `flex-1` can grow but never shrink below
          its content, so on a short screen the nav kept its full height and
          shoved the logout footer off the bottom. Now the *nav* scrolls
          (rarely, with only 3 links) and the footer stays put. */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-accent-soft font-medium text-primary"
                  : "text-muted hover:bg-accent-soft/60 hover:text-text"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div
        className={`flex shrink-0 flex-col gap-3 border-t border-border px-3 py-4 ${
          collapsed ? "items-center" : "px-5"
        }`}
      >
        {!collapsed && user && (
          <div className="flex w-full flex-col overflow-hidden text-xs">
            <span className="flex items-center gap-1 truncate font-medium text-text">
              {user.name}
              {user.role === "ADMIN" && <Shield className="h-3 w-3 shrink-0 text-primary" aria-label="Admin" />}
            </span>
            <span className="truncate text-muted">{user.email}</span>
          </div>
        )}
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : "w-full justify-between"}`}>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-border text-xs text-text hover:border-primary ${
              collapsed ? "h-9 w-9 justify-center" : "px-3 py-1.5"
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
