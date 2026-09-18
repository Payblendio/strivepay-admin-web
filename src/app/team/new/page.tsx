import type { Metadata } from "next";
import Link from "next/link";
import { CreateAdminForm } from "@/components/create-admin-form";
import { OpsShell } from "@/components/ops-shell";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, text } from "@/lib/values";

export const metadata: Metadata = { title: "Create administrator" };

export default async function CreateAdminPage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.adminsManage, "/team/new");
  const rolesResponse = await adminBackend(token, "/v1/admin/rbac/roles");
  const rolesOk = rolesResponse.ok;
  const rolePayload = rolesOk ? await responseBody(rolesResponse) : [];
  const roleOptions = (Array.isArray(rolePayload) ? rolePayload : []).map(asRecord).map((row) => ({
    slug: text(row, "slug"),
    name: text(row, "name"),
  })).filter((row) => row.slug && row.slug !== "—");

  return (
    <OpsShell
      principal={principal}
      eyebrow="Access control"
      title="Create administrator"
      copy="Invite an operator and assign their initial roles."
    >
      <p><Link className="ops-link" href="/team">Back to team</Link></p>
      <section className="ops-panel">
        {!rolesOk ? (
          <EmptyState compact title="Roles unavailable" description="Role options could not be loaded. Refresh before inviting an operator." />
        ) : (
          <CreateAdminForm roleOptions={roleOptions} />
        )}
      </section>
    </OpsShell>
  );
}
