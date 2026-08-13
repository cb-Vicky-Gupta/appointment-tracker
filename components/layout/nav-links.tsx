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

// The admin panel's sidebar — and, per Sidebar's role check, the *only*
// nav an ADMIN-role account ever sees, in either section. An admin
// account isn't assumed to also be a PG resident, so it deliberately
// doesn't include Dashboard/Patients — those pages assume "your own
// patient log", which an admin-only account has none of. Any patient data
// an admin needs to inspect is surfaced read-only inside /admin/users/:id
// instead (never the resident CRUD pages — see PatientCard's Link target,
// which 404s for anyone but the owning resident by design).
export const ADMIN_NAV_LINKS: NavLink[] = [
  { href: "/admin", label: "Overview", icon: Shield },
  { href: "/admin/users", label: "Users", icon: ClipboardList },
  { href: "/profile", label: "Profile", icon: UserCircle },
];
