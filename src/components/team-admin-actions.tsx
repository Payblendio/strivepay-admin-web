"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ReasonModal } from "@/components/reason-modal";
import { Badge, Button } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { toneForStatus } from "@/lib/values";

type RoleOption = { slug: string; name: string };

export function TeamAdminActions({
  adminId,
  status,
  roles,
  roleOptions,
}: {
  adminId: string;
  status: string;
  roles: string[];
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const [action, setAction] = useState<"status" | "roles" | null>(null);
  const [nextStatus, setNextStatus] = useState(status === "DISABLED" ? "ACTIVE" : "DISABLED");
  const [selectedRoles, setSelectedRoles] = useState(roles);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sortedOptions = useMemo(
    () => [...roleOptions].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug)),
    [roleOptions],
  );

  async function confirm(reason: string) {
    if (!action) return;
    setBusy(true);
    setError("");
    const path = action === "status"
      ? `/api/admin/rbac/admins/${adminId}/status`
      : `/api/admin/rbac/admins/${adminId}/roles`;
    const body = action === "status"
      ? { status: nextStatus, reason }
      : { roles: selectedRoles, reason };
    const response = await adminFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "The administrator could not be updated.");
      return;
    }
    setAction(null);
    router.refresh();
  }

  function toggleRole(slug: string) {
    setSelectedRoles((current) => (
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    ));
  }

  return (
    <div className="ops-stack">
      <p>
        Status <Badge tone={toneForStatus(status)} dot>{status || "—"}</Badge>
      </p>
      <div className="reason-actions">
        <Button
          size="small"
          variant="secondary"
          onClick={() => {
            setNextStatus(status === "DISABLED" ? "ACTIVE" : "DISABLED");
            setError("");
            setAction("status");
          }}
        >
          Change status
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => {
            setSelectedRoles(roles);
            setError("");
            setAction("roles");
          }}
        >
          Change roles
        </Button>
      </div>

      <ReasonModal
        open={action === "status"}
        title="Change administrator status"
        description="This update is written to the admin audit trail."
        confirmLabel="Save status"
        busy={busy}
        error={error}
        extraFields={(
          <label className="sp-field">
            <span>Status</span>
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </label>
        )}
        onClose={() => { if (!busy) setAction(null); }}
        onConfirm={confirm}
      />

      <ReasonModal
        open={action === "roles"}
        title="Change administrator roles"
        description="Select the roles this operator should hold."
        confirmLabel="Save roles"
        busy={busy}
        error={error}
        extraFields={(
          <fieldset className="ops-check-list">
            <legend>Roles</legend>
            {sortedOptions.length ? sortedOptions.map((role) => (
              <label key={role.slug} className="ops-check-row">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.slug)}
                  onChange={() => toggleRole(role.slug)}
                />
                <span>
                  <strong>{role.name}</strong>
                  {role.slug.toLowerCase() !== role.name.trim().toLowerCase() ? (
                    <small>{role.slug}</small>
                  ) : null}
                </span>
              </label>
            )) : (
              <p>No roles are available. Create roles under Roles before assigning them.</p>
            )}
          </fieldset>
        )}
        onClose={() => { if (!busy) setAction(null); }}
        onConfirm={confirm}
      />
    </div>
  );
}
