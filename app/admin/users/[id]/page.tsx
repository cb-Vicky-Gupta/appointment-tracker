"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  LogOut,
  Shield,
  ShieldOff,
  Trash2,
  TriangleAlert,
  UserRoundCog,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAdminUserDetail } from "@/lib/hooks/use-admin-user-detail";
import { useUpdateAdminUser, useDeleteAdminUser } from "@/lib/hooks/use-admin-user-mutations";
import { Spinner } from "@/components/ui/Spinner";

// Admin panel user detail (Plan Phase C). Auth-gating + chrome live in
// app/admin/layout.tsx. Every action here confirms inline rather than
// bouncing through a bare confirm() — Delete specifically requires typing
// the account's email, since it's the one action nothing here can undo.
export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentAdmin } = useAuth();
  const { data, isLoading, isError, error } = useAdminUserDetail(params.id);
  const updateUser = useUpdateAdminUser(params.id);
  const deleteUser = useDeleteAdminUser();

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const isSelf = currentAdmin?.id === params.id;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <Link
        href="/admin/users"
        className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner label="Loading account…" />
        </div>
      )}

      {isError && error instanceof Error && error.message === "NOT_FOUND" && (
        <p className="text-sm text-danger">This account doesn&rsquo;t exist (it may have just been deleted).</p>
      )}
      {isError && error instanceof Error && error.message !== "NOT_FOUND" && (
        <p className="text-sm text-danger">Couldn&rsquo;t load this account: {error.message}</p>
      )}

      {data && (
        <>
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-semibold">
                  {data.user.name}
                  {data.user.role === "ADMIN" && <Shield className="h-5 w-5 text-primary" aria-label="Admin" />}
                </h1>
                <p className="mt-0.5 text-sm text-muted">{data.user.email}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  data.user.status === "SUSPENDED"
                    ? "bg-danger/10 text-danger"
                    : "bg-accent-soft text-primary"
                }`}
              >
                {data.user.status === "SUSPENDED" ? "Suspended" : "Active"}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Field label="Gender" value={data.user.gender} />
              <Field label="Student type" value={data.user.studentType ?? "—"} />
              <Field label="Year" value={data.user.year ?? "—"} />
              <Field label="Phone" value={data.user.phone ?? "—"} />
              <Field label="Specialization" value={data.user.specialization ?? "—"} />
              <Field label="Institute" value={data.user.institute ?? "—"} className="col-span-2" />
              <Field label="Joined" value={new Date(data.user.createdAt).toLocaleDateString()} />
            </dl>

            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
              <Field label="Patients" value={String(data.user.patientCount)} />
              <Field label="Appointments" value={String(data.user.appointmentCount)} />
              <Field label="Active sessions" value={String(data.user.activeSessionCount)} />
            </dl>
          </div>

          {isSelf ? (
            <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
              This is your own account — suspend, force-logout, role, and delete actions aren&rsquo;t
              available on yourself here.
            </p>
          ) : (
            <>
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
            <h2 className="text-sm font-medium text-muted">Actions</h2>

            {updateUser.isError && (
              <p className="text-sm text-danger">
                {updateUser.error instanceof Error ? updateUser.error.message : "That action failed."}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={updateUser.isPending}
                onClick={() =>
                  updateUser.mutate({ status: data.user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED" })
                }
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                  data.user.status === "SUSPENDED"
                    ? "border-primary/30 text-primary hover:border-primary"
                    : "border-border hover:border-danger hover:text-danger"
                }`}
              >
                {data.user.status === "SUSPENDED" ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                {data.user.status === "SUSPENDED" ? "Reactivate account" : "Suspend account"}
              </button>

              <button
                type="button"
                disabled={updateUser.isPending}
                onClick={() => updateUser.mutate({ forceLogout: true })}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                Force logout ({data.user.activeSessionCount} session
                {data.user.activeSessionCount === 1 ? "" : "s"})
              </button>

              <button
                type="button"
                disabled={updateUser.isPending}
                onClick={() =>
                  updateUser.mutate({ role: data.user.role === "ADMIN" ? "USER" : "ADMIN" })
                }
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserRoundCog className="h-4 w-4" />
                {data.user.role === "ADMIN" ? "Remove admin access" : "Make admin"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-surface p-6">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-danger">
              <TriangleAlert className="h-4 w-4" />
              Danger zone
            </h2>
            <p className="text-sm text-muted">
              Permanently deletes this account and all {data.user.patientCount} of their patient
              {data.user.patientCount === 1 ? "" : "s"} (and every appointment under them). This can&rsquo;t
              be undone. Type <span className="font-mono text-text">{data.user.email}</span> to confirm.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={data.user.email}
                className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-danger"
              />
              <button
                type="button"
                disabled={deleteConfirmText !== data.user.email || deleteUser.isPending}
                onClick={async () => {
                  await deleteUser.mutateAsync(data.user.id);
                  router.push("/admin/users");
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-danger px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                {deleteUser.isPending ? "Deleting…" : "Delete account permanently"}
              </button>
            </div>
            {deleteUser.isError && (
              <p className="text-sm text-danger">
                {deleteUser.error instanceof Error ? deleteUser.error.message : "Delete failed."}
              </p>
            )}
          </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  className = "",
}: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
