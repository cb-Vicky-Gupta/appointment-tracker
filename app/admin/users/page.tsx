"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Shield, ShieldOff } from "lucide-react";
import { useAdminUsers, type AdminUserListItem } from "@/lib/hooks/use-admin-users";
import { useUpdateAdminUser } from "@/lib/hooks/use-admin-user-mutations";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { Spinner } from "@/components/ui/Spinner";

const PAGE_SIZE = 20;

// Admin panel user directory (Plan Phase C). Auth-gating + chrome live in
// app/admin/layout.tsx. Row actions are deliberately limited to the one
// reversible, low-risk toggle (suspend/reactivate) — role changes and
// delete both live on the detail page instead, where there's room for a
// real confirmation rather than a dense table inviting a misclick.
export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const { data, isLoading, isError, error } = useAdminUsers(search, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-muted">Every registered account, across every institute.</p>
      </div>

      <label className="relative block max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search by name, email, or institute"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner label="Loading users…" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-danger">
          Couldn&rsquo;t load users: {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}

      {data && data.users.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            {search ? `No accounts match "${search}".` : "No accounts yet."}
          </p>
        </div>
      )}

      {data && data.users.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Institute</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Patients</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}

function UserRow({ user }: Readonly<{ user: AdminUserListItem }>) {
  const updateUser = useUpdateAdminUser(user.id);
  const suspended = user.status === "SUSPENDED";

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <Link href={`/admin/users/${user.id}`} className="font-medium hover:text-primary hover:underline">
          {user.name}
        </Link>
        <div className="text-xs text-muted">{user.email}</div>
      </td>
      <td className="px-4 py-3 text-muted">{user.institute ?? "—"}</td>
      <td className="px-4 py-3">
        {user.role === "ADMIN" ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-primary">Admin</span>
        ) : (
          <span className="text-xs text-muted">User</span>
        )}
      </td>
      <td className="px-4 py-3">
        {suspended ? (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">Suspended</span>
        ) : (
          <span className="text-xs text-muted">Active</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums">{user.patientCount}</td>
      <td className="px-4 py-3 text-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={updateUser.isPending}
          onClick={() => updateUser.mutate({ status: suspended ? "ACTIVE" : "SUSPENDED" })}
          title={suspended ? "Reactivate" : "Suspend"}
          className={`flex w-fit cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
            suspended
              ? "border-primary/30 text-primary hover:border-primary"
              : "border-border text-muted hover:border-danger hover:text-danger"
          }`}
        >
          {suspended ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          {suspended ? "Reactivate" : "Suspend"}
        </button>
      </td>
    </tr>
  );
}
