import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { RoleCreateForm } from "@/components/role-create-form";
import { PERMISSIONS } from "@/lib/admin-access";
import { requireAdmin } from "@/lib/admin-session.server";

export const metadata: Metadata = { title: "Create role" };

export default async function CreateRolePage() {
  const { principal } = await requireAdmin(PERMISSIONS.rolesManage, "/roles/new");

  return (
    <OpsShell
      principal={principal}
      eyebrow="Access control"
      title="Create role"
      copy="Define a permission bundle for console operators."
    >
      <p><Link className="ops-link" href="/roles">Back to roles</Link></p>
      <section className="ops-panel">
        <RoleCreateForm />
      </section>
    </OpsShell>
  );
}
