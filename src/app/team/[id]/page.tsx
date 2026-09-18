import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconUserShield, IconId, IconAdjustments } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { TeamAdminActions } from "@/components/team-admin-actions";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, asString, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Team member" };

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.adminsManage, `/team/${id}`);

  const [adminsResponse, rolesResponse] = await Promise.all([
    adminBackend(token, "/v1/admin/rbac/admins"),
    adminBackend(token, "/v1/admin/rbac/roles"),
  ]);

  if (!adminsResponse.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Access control" title="Team member" copy={id}>
        <EmptyState title="Team member unavailable" description="Operators could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }

  const adminsPayload = await responseBody(adminsResponse);
  const admins = (Array.isArray(adminsPayload) ? adminsPayload : []).map(asRecord);
  const row = admins.find((item) => text(item, "id") === id);
  if (!row) notFound();

  const rolesOk = rolesResponse.ok;
  const rolesPayload = rolesOk ? await responseBody(rolesResponse) : [];
  const roleOptions = (Array.isArray(rolesPayload) ? rolesPayload : []).map(asRecord).map((role) => ({
    slug: asString(role.slug),
    name: asString(role.name, asString(role.slug)),
  })).filter((role) => role.slug);

  const name = text(row, "display_name", "displayName");
  const email = text(row, "email");
  const status = text(row, "status");
  const roles = Array.isArray(row.roles) ? row.roles.map(String) : [];
  const title = name === "—" ? "Team member" : name;
  const lastLogin = formatInstant(row.last_login_at ?? row.lastLoginAt);

  return (
    <OpsShell principal={principal} eyebrow="Access control" title={title} copy={email}>
      <OpsDetailShell
        backHref="/team"
        backLabel="Back to team"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconUserShield size={20} />}
            title={title}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Email", value: email },
              { label: "Status", value: status },
              { label: "Roles", value: roles.length ? roles.join(", ") : "—" },
              { label: "Last login", value: lastLogin },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <OpsDetailSection title="Identity">
                <OpsDetailFacts
                  items={[
                    { label: "Admin id", value: text(row, "id") },
                    { label: "Name", value: name },
                    { label: "Email", value: email },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Roles", value: roles.length ? roles.join(", ") : "—" },
                    { label: "Last login", value: lastLogin },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
          {
            id: "actions",
            label: "Actions",
            icon: <IconAdjustments size={16} />,
            content: (
              <OpsDetailSection title="Operator controls" kicker="Actions">
                {!rolesOk ? (
                  <EmptyState compact title="Roles unavailable" description="Role options could not be loaded. You can still review this operator, but role changes need a refresh." />
                ) : (
                  <TeamAdminActions
                    adminId={id}
                    status={status === "—" ? "ACTIVE" : status}
                    roles={roles}
                    roleOptions={roleOptions}
                  />
                )}
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
