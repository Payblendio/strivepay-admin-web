import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconScale } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Reconciliation item" };

export default async function ReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.coverageView, `/reconciliation/${id}`);
  const response = await adminBackend(token, `/v1/admin/reconciliation/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Coverage" title="Reconciliation" copy={id}>
        <EmptyState title="Reconciliation item unavailable" description="This item could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const status = text(row, "status");
  const severity = text(row, "severity");
  const orderId = text(row, "order_id", "orderId");
  const orderValue = orderId === "—"
    ? "—"
    : <Link className="ops-link" href={`/transactions/${orderId}`}>{orderId}</Link>;

  return (
    <OpsShell principal={principal} eyebrow="Coverage" title="Reconciliation" copy={text(row, "mismatch_type", "mismatchType")}>
      <OpsDetailShell
        backHref="/reconciliation"
        backLabel="Back to reconciliation"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconScale size={20} />}
            title={text(row, "mismatch_type", "mismatchType")}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Provider", value: text(row, "provider_code", "providerCode") },
              { label: "Severity", value: severity },
              { label: "Status", value: status },
              { label: "Order", value: orderValue },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <OpsDetailSection title="Reconciliation item" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Item id", value: text(row, "id") },
                    { label: "Order", value: orderValue },
                    { label: "Provider", value: text(row, "provider_code", "providerCode") },
                    { label: "Provider reference", value: text(row, "provider_reference", "providerReference") },
                    { label: "Severity", value: <Badge tone={toneForStatus(severity)}>{severity}</Badge> },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Mismatch", value: text(row, "mismatch_type", "mismatchType") },
                    { label: "Expected", value: text(row, "expected") },
                    { label: "Actual", value: text(row, "actual") },
                    { label: "Resolution", value: text(row, "resolution") },
                    { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
                    { label: "Resolved", value: formatInstant(row.resolved_at ?? row.resolvedAt) },
                  ]}
                />
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
