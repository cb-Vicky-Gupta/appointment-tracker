import { LayoutDashboard, Users, UserCircle, Shield, ClipboardList } from "lucide-react";
import type { ComponentType } from "react";

export interface NavLink {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// The regular resident-facing sidebar (Phase 10).
export const DASHBOARD_NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

// The admin panel's own sidebar (Plan Phase C) — deliberately doesn't
// include Patients/Profile; an admin returns to those via the "Ilazdoot"
// brand link (AppShell's `homeHref`), not a duplicated nav entry.
export const ADMIN_NAV_LINKS: NavLink[] = [
  { href: "/admin", label: "Overview", icon: Shield },
  { href: "/admin/users", label: "Users", icon: ClipboardList },
];

// The single extra entry appended to the *regular* sidebar for admins
// (Sidebar's `showAdminLink`) — distinct label from ADMIN_NAV_LINKS[0]
// ("Admin" here vs "Overview" there) since the context differs.
export const ADMIN_ENTRY_LINK: NavLink = { href: "/admin", label: "Admin", icon: Shield };
