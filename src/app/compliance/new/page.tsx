import type { Metadata } from "next";
import Link from "next/link";
import { ComplianceDocForm } from "@/components/compliance-doc-form";
import { OpsShell } from "@/components/ops-shell";
import { PERMISSIONS } from "@/lib/admin-access";
import { requireAdmin } from "@/lib/admin-session.server";

export const metadata: Metadata = { title: "Configure legal document" };

export default async function ConfigureComplianceDocPage() {
  const { principal } = await requireAdmin(PERMISSIONS.complianceManage, "/compliance/new");

  return (
    <OpsShell
      principal={principal}
      eyebrow="Compliance"
      title="Configure document"
      copy="Register a Bakkt-facing legal document version."
    >
      <p><Link className="ops-link" href="/compliance">Back to documents</Link></p>
      <section className="ops-panel">
        <ComplianceDocForm />
      </section>
    </OpsShell>
  );
}
