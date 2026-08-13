"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Spinner } from "@/components/ui/Spinner";

const SIDEBAR_COLLAPSED_KEY = "pg-tracker-sidebar-collapsed";

// Phase 10 — sidebar dashboard shell (PRD Reference G), and the one place
// the "wait for session, then redirect if there isn't one" guard lives now.
// Every page under app/(dashboard)/* used to call useRequireAuth() itself and
// repeat an <AppHeader/> + loading branch (Phases 6-9) — hoisting it here
// means a page only renders once a session is confirmed, and the sidebar
// itself stays mounted across navigation instead of remounting per page.
//
// Root is `h-dvh` + `overflow-hidden` so the sidebar is pinned on screen —
// only the content pane (`overflow-y-auto`) scrolls, not the whole page
// (which would otherwise drag the sidebar along with it, since body itself
// has no height cap — see app/layout.tsx).
export default function DashboardGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { ready } = useRequireAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // This whole tree only ever renders once `ready` is true (see the early
  // return below), which never happens during the server/first-client-render
  // pass — so, unlike lib/theme-context.tsx's localStorage read, there's no
  // hydration mismatch risk here; reading synchronously would be fine too,
  // but the effect keeps this component's initial render trivially SSR-safe
  // regardless.
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    // Intentional one-time sync from localStorage on mount (see the same
    // pattern/rationale in lib/theme-context.tsx), not derived-from-props state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-1 overflow-hidden">
      <aside
        className={`hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 md:flex md:flex-col ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 cursor-default bg-black/40"
          />
          <aside className="relative flex h-full w-64 flex-col bg-surface shadow-xl">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <MobileTopBar onOpenMenu={() => setMobileNavOpen(true)} />
        {children}
      </div>
    </div>
  );
}
