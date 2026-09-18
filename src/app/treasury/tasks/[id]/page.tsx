import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBuildingBank } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { PERMISSIONS } from "@/lib/admin-access";
import { loadList } from "@/lib/admin-load";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatAmount, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Treasury task" };

export default async function TreasuryTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, `/treasury/tasks/${id}`);
  const response = await adminBackend(token, `/v1/admin/treasury/tasks/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Liquidity desk" title="Treasury task" copy={id}>
        <EmptyState title="Treasury task unavailable" description="This task could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const status = text(row, "status");
  const asset = text(row, "asset", "asset_code", "assetCode");
  const conversionId = text(row, "conversion_id", "conversionId");
  const costsResponse = conversionId !== "—"
    ? await adminBackend(token, `/v1/admin/automatic-conversions/${conversionId}/costs`)
    : null;
  const costsLoad = costsResponse ? await loadList(costsResponse) : null;
  const costs = costsLoad?.rows ?? [];

  return (
    <OpsShell principal={principal} eyebrow="Liquidity desk" title="Treasury task" copy={text(row, "type", "task_type", "taskType")}>
      <OpsDetailShell
        backHref="/treasury"
        backLabel="Back to treasury"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconBuildingBank size={20} />}
            title={text(row, "type", "task_type", "taskType")}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Direction", value: text(row, "direction") },
              { label: "Asset", value: asset },
              { label: "Required", value: formatAmount(row.required_amount ?? row.requiredAmount, asset) },
              { label: "Shortfall", value: formatAmount(row.shortfall_amount ?? row.shortfallAmount, asset) },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <OpsDetailSection title="Treasury task" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Task id", value: text(row, "id") },
                    {
                      label: "Conversion",
                      value: conversionId !== "—" ? conversionId : "—",
                    },
                    { label: "Type", value: text(row, "type", "task_type", "taskType") },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Direction", value: text(row, "direction") },
                    { label: "Asset", value: asset },
                    { label: "Environment", value: text(row, "environment") },
                    { label: "Required", value: formatAmount(row.required_amount ?? row.requiredAmount, asset) },
                    { label: "Available", value: formatAmount(row.available_amount ?? row.availableAmount, asset) },
                    { label: "Shortfall", value: formatAmount(row.shortfall_amount ?? row.shortfallAmount, asset) },
                    { label: "Reserved customer", value: formatAmount(row.reserved_customer_amount ?? row.reservedCustomerAmount, asset) },
                    { label: "Funded", value: formatAmount(row.funded_amount ?? row.fundedAmount, asset) },
                    {
                      label: "Evidenced cost",
                      value: formatAmount(
                        row.evidenced_cost_amount ?? row.evidencedCostAmount,
                        row.evidenced_cost_asset ?? row.evidencedCostAsset ?? row.evidenced_cost_asset_code,
                      ),
                    },
                    { label: "Action required", value: text(row, "action_required", "actionRequired") },
                    { label: "Evidence reference", value: text(row, "evidence_reference", "evidenceReference") },
                    { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
                  ]}
                />
                <p style={{ marginTop: "1rem" }}>
                  <Link className="ops-link" href="/treasury">Return to treasury desk</Link>
                </p>
              </OpsDetailSection>
            ),
          },
          {
            id: "costs",
            label: "Conversion costs",
            content: (
              <OpsDetailSection title="Automatic conversion costs" kicker="Treasury">
                {!costsLoad || costsLoad.ok ? (
                  <DataTable
                    columns={[
                      { key: "type", header: "Type", render: (cost) => text(cost, "type", "cost_type", "costType") },
                      { key: "provider", header: "Provider", render: (cost) => text(cost, "provider", "provider_code", "providerCode") },
                      {
                        key: "actual",
                        header: "Actual",
                        render: (cost) => formatAmount(cost.actual_amount ?? cost.actualAmount, cost.asset ?? cost.asset_code ?? cost.assetCode),
                      },
                      {
                        key: "valuation",
                        header: "Valuation",
                        render: (cost) => formatAmount(cost.valuation_amount ?? cost.valuationAmount, cost.valuation_currency ?? cost.valuationCurrency ?? cost.valuation_currency_code),
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (cost) => <Badge tone={toneForStatus(text(cost, "status"))}>{text(cost, "status")}</Badge>,
                      },
                      { key: "created", header: "Created", render: (cost) => formatInstant(cost.created_at ?? cost.createdAt) },
                    ]}
                    rows={costs}
                    getKey={(cost) => text(cost, "id")}
                    empty={<EmptyState compact title="No conversion costs" description="Costs appear once the linked conversion records them." />}
                  />
                ) : (
                  <EmptyState compact title="Costs unavailable" description={costsLoad.error} />
                )}
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
