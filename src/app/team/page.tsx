import type { Metadata } from "next";
import Link from "next/link";
import { CsvExportButton } from "@/components/csv-export-button";
import { OpsShell } from "@/components/ops-shell";
import { ViewLink } from "@/components/view-link";
import { DataTable, TablePerson } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, initials, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Team" };

function rolesLabel(row: Record<string, unknown>) {
  const roles = row.roles;
  if (Array.isArray(roles)) return roles.map(String).filter(Boolean).join(", ") || "—";
  return text(row, "roles");
}

export default async function TeamPage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.adminsManage, "/team");
  const response = await adminBackend(token, "/v1/admin/rbac/admins");
  const payload = response.ok ? await responseBody(response) : [];
  const rows = (Array.isArray(payload) ? payload : []).map(asRecord);

  return (
    <OpsShell
      principal={principal}
      eyebrow="Access control"
      title="Team"
      copy="Operators with console access and assigned roles."
    >
      <section className="ops-panel">
        <div className="ops-panel-heading">
          <div>
            <span>Operators</span>
            <h2>Team members</h2>
          </div>
          <div className="ops-header-actions">
            <CsvExportButton
              filename="team.csv"
              headers={["id", "email", "displayName", "status", "roles"]}
              rows={rows.map((row) => [
                text(row, "id"),
                text(row, "email"),
                text(row, "display_name", "displayName"),
                text(row, "status"),
                rolesLabel(row),
              ])}
            />
            <Link className="sp-button primary medium" href="/team/new">Create administrator</Link>
          </div>
        </div>
        {!response.ok ? (
          <EmptyState compact title="Team unavailable" description="Operators could not be loaded." />
        ) : (
          <DataTable
            columns={[
              {
                key: "name",
                header: "Name",
                render: (row) => {
                  const name = text(row, "display_name", "displayName");
                  const email = text(row, "email");
                  return (
                    <TablePerson
                      initials={initials(name === "—" ? email : name)}
                      title={name === "—" ? email : name}
                      subtitle={email}
                    />
                  );
                },
              },
              { key: "email", header: "Email", render: (row) => text(row, "email") },
              { key: "roles", header: "Roles", render: (row) => rolesLabel(row) },
              {
                key: "status",
                header: "Status",
                render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge>,
              },
              { key: "lastLogin", header: "Last login", render: (row) => formatInstant(row.last_login_at ?? row.lastLoginAt) },
              {
                key: "view",
                header: "",
                render: (row) => <ViewLink href={`/team/${text(row, "id")}`} />,
              },
            ]}
            rows={rows}
            getKey={(row) => text(row, "id")}
            empty={<EmptyState compact title="No team members" description="Invite operators once roles are ready." />}
          />
        )}
      </section>
    </OpsShell>
  );
}
