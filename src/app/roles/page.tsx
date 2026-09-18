import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { RolePermissionMatrix } from "@/components/role-permission-matrix";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, asString, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Roles" };

function permissionCount(row: Record<string, unknown>) {
  const permissions = row.permissions;
  return Array.isArray(permissions) ? String(permissions.length) : "0";
}

function boolLabel(value: unknown) {
  if (value === true || value === "true") return "Yes";
  if (value === false || value === "false") return "No";
  return "—";
}

export default async function RolesPage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.rolesManage, "/roles");
  const response = await adminBackend(token, "/v1/admin/rbac/roles");
  const payload = response.ok ? await responseBody(response) : [];
  const rows = (Array.isArray(payload) ? payload : []).map(asRecord);
  const canCreate = hasPermission(principal.permissions, PERMISSIONS.rolesManage);
  const matrixRoles = rows.map((row) => ({
    id: text(row, "id"),
    slug: text(row, "slug"),
    name: text(row, "name"),
    systemRole: row.system_role === true || row.systemRole === true,
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
  })).filter((row) => row.id && row.id !== "—");

  return (
    <OpsShell
      principal={principal}
      eyebrow="Access control"
      title="Roles"
      copy="Permission bundles assigned to console operators."
    >
      <section className="ops-panel">
        <div className="ops-panel-heading">
          <div>
            <span>Access</span>
            <h2>Roles</h2>
          </div>
          {canCreate ? <Link className="sp-button primary medium" href="/roles/new">Create role</Link> : null}
        </div>
        {!response.ok ? (
          <EmptyState compact title="Roles unavailable" description="Roles could not be loaded." />
        ) : (
          <DataTable
            columns={[
              { key: "name", header: "Name", render: (row) => text(row, "name") },
              { key: "slug", header: "Slug", render: (row) => text(row, "slug") },
              { key: "system", header: "System", render: (row) => boolLabel(row.system_role ?? row.systemRole) },
              {
                key: "active",
                header: "Active",
                render: (row) => {
                  const active = row.active === true || row.active === "true";
                  return <Badge tone={toneForStatus(active ? "ACTIVE" : "DISABLED")} dot>{active ? "Active" : "Inactive"}</Badge>;
                },
              },
              { key: "permissions", header: "Permissions", render: (row) => permissionCount(row) },
            ]}
            rows={rows}
            getKey={(row) => text(row, "id") || asString(row.slug)}
            empty={<EmptyState compact title="No roles" description="Create a role before inviting operators." />}
          />
        )}
      </section>

      <section className="ops-panel">
        <h2>Permission matrix</h2>
        {!response.ok ? (
          <EmptyState compact title="Permission matrix unavailable" description="Roles could not be loaded." />
        ) : (
          <RolePermissionMatrix roles={matrixRoles} />
        )}
      </section>
    </OpsShell>
  );
}
