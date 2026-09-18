import type { Metadata } from "next";
import Link from "next/link";
import { OpsShell } from "@/components/ops-shell";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, text } from "@/lib/values";

export const metadata: Metadata = { title: "Compliance" };

function asList(payload: unknown) {
  return (Array.isArray(payload) ? payload : []).map(asRecord);
}

export default async function CompliancePage() {
  const { token, principal } = await requireAdmin(PERMISSIONS.complianceManage, "/compliance");
  const response = await adminBackend(token, "/v1/admin/compliance/legal-documents");
  const rows = response.ok ? asList(await responseBody(response)) : [];

  return (
    <OpsShell
      principal={principal}
      eyebrow="Compliance"
      title="Legal documents"
      copy="Bakkt-facing terms and privacy document versions."
    >
      <section className="ops-panel">
        <div className="ops-panel-heading">
          <div>
            <span>Documents</span>
            <h2>Legal documents</h2>
          </div>
          <Link className="sp-button primary medium" href="/compliance/new">Configure document</Link>
        </div>
        {!response.ok ? (
          <EmptyState compact title="Legal documents unavailable" description="Compliance documents could not be loaded." />
        ) : (
          <DataTable
            columns={[
              { key: "type", header: "Type", render: (row) => text(row, "type", "document_type", "documentType") },
              { key: "version", header: "Version", render: (row) => text(row, "version") },
              { key: "url", header: "URL", render: (row) => text(row, "url", "document_url", "documentUrl") },
              { key: "hash", header: "Hash", render: (row) => text(row, "hash", "content_sha256", "contentSha256Base64").slice(0, 18) + "…" },
              { key: "effective", header: "Effective", render: (row) => formatInstant(row.effective_at ?? row.effectiveAt) },
            ]}
            rows={rows}
            getKey={(row) => text(row, "id")}
            empty={<EmptyState compact title="No legal documents" description="Configure an HTTPS document version to begin." />}
          />
        )}
      </section>
    </OpsShell>
  );
}
