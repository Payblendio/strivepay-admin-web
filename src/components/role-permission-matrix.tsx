"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReasonModal } from "@/components/reason-modal";
import { Button, TextField } from "@/components/ui/primitives";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminFetch } from "@/lib/admin-session";

type Role = {
  id: string;
  slug: string;
  name: string;
  systemRole?: boolean;
  permissions: string[];
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export function RolePermissionMatrix({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Role | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return roles;
    return roles.filter((role) => (
      role.name.toLowerCase().includes(needle)
      || role.slug.toLowerCase().includes(needle)
      || role.permissions.some((permission) => permission.toLowerCase().includes(needle))
    ));
  }, [query, roles]);

  function openEdit(role: Role) {
    setEditing(role);
    setSelected([...role.permissions]);
    setName(role.name);
    setError("");
  }

  function toggle(permission: string) {
    setSelected((current) => (
      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]
    ));
  }

  async function confirm(reason: string) {
    if (!editing) return;
    setBusy(true);
    setError("");
    const response = await adminFetch(`/api/admin/rbac/roles/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), permissions: selected, reason }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "Role could not be updated.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="ops-stack">
      <TextField label="Search roles or permissions" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="ops-role-matrix">
        <div className="ops-role-matrix-head">
          <span>Permission</span>
          {filtered.map((role) => <span key={role.id}>{role.slug}</span>)}
        </div>
        {ALL_PERMISSIONS.map((permission) => (
          <div className="ops-role-matrix-row" key={permission}>
            <span>{permission}</span>
            {filtered.map((role) => (
              <span key={`${role.id}-${permission}`} className={role.permissions.includes(permission) ? "on" : ""}>
                {role.permissions.includes(permission) ? "●" : "·"}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="ops-inline-actions">
        {filtered.map((role) => (
          <Button key={role.id} size="small" variant="secondary" onClick={() => openEdit(role)}>
            Edit {role.slug}
          </Button>
        ))}
      </div>

      <ReasonModal
        open={Boolean(editing)}
        title={editing ? `Edit ${editing.slug}` : "Edit role"}
        description="Replace the permission set for this role."
        confirmLabel="Save role"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <fieldset className="ops-check-list">
              <legend>Permissions</legend>
              {ALL_PERMISSIONS.map((permission) => (
                <label key={permission} className="ops-check-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(permission)}
                    onChange={() => toggle(permission)}
                  />
                  <span>
                    <strong>{permission}</strong>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        )}
        onClose={() => { if (!busy) setEditing(null); }}
        onConfirm={confirm}
      />
    </div>
  );
}
