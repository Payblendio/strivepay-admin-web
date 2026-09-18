import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCoin } from "@tabler/icons-react";
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
import { asRecord, assetOrAny, formatAmount, formatInstant, formatPercentRate, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Fee rule" };

export default async function FeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.feesView, `/fees/${id}`);
  const response = await adminBackend(token, `/v1/admin/fees/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Pricing desk" title="Fee rule" copy={id}>
        <EmptyState title="Fee rule unavailable" description="This fee rule could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const active = row.active === true || row.active === "true";
  const source = assetOrAny(row.source_asset ?? row.sourceAsset ?? row.source_asset_code ?? row.sourceAssetCode);
  const destination = assetOrAny(row.destination_asset ?? row.destinationAsset ?? row.destination_asset_code ?? row.destinationAssetCode);
  const pct = formatPercentRate(row.percentage_rate ?? row.percentageRate);
  const direction = text(row, "direction");
  const scopeType = text(row, "scope_type", "scopeType");
  const scopeId = text(row, "scope_id", "scopeId");
  const route = `${source} → ${destination}`;
  const title = source === "Any" && destination === "Any" && direction !== "—"
    ? direction
    : route;

  return (
    <OpsShell principal={principal} eyebrow="Pricing desk" title="Fee rule" copy={`${title} · ${pct}`}>
      <OpsDetailShell
        backHref="/fees"
        backLabel="Back to fees"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconCoin size={20} />}
            title={title}
            status={<Badge tone={toneForStatus(active ? "ACTIVE" : "DISABLED")} dot>{active ? "Active" : "Inactive"}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Direction", value: direction },
              { label: "Method", value: text(row, "payment_method", "paymentMethod") },
              { label: "Percentage", value: pct },
              { label: "Sync", value: text(row, "sync_status", "syncStatus") },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <OpsDetailSection title="Fee rule" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Rule id", value: text(row, "id") },
                    { label: "Scope", value: scopeType },
                    {
                      label: "Scope party",
                      value: scopeType === "PARTY" && scopeId !== "—"
                        ? <Link className="ops-link" href={`/customers/${scopeId}`}>{scopeId}</Link>
                        : scopeId,
                    },
                    { label: "Direction", value: direction },
                    { label: "Bakkt direction", value: text(row, "bakkt_direction", "bakktDirection") },
                    { label: "Bakkt entity", value: text(row, "bakkt_entity_type", "bakktEntityType") },
                    { label: "Source asset", value: source },
                    { label: "Destination asset", value: destination },
                    { label: "Payment method", value: text(row, "payment_method", "paymentMethod") },
                    { label: "Percentage rate", value: pct },
                    {
                      label: "Fixed amount",
                      value: formatAmount(row.fixed_amount ?? row.fixedAmount, row.fee_asset ?? row.feeAsset ?? row.fee_asset_code ?? row.feeAssetCode),
                    },
                    {
                      label: "Minimum amount",
                      value: formatAmount(row.minimum_amount ?? row.minimumAmount, row.fee_asset ?? row.feeAsset ?? row.fee_asset_code ?? row.feeAssetCode),
                    },
                    { label: "Fee asset", value: text(row, "fee_asset", "feeAsset", "fee_asset_code", "feeAssetCode") },
                    {
                      label: "Active",
                      value: <Badge tone={toneForStatus(active ? "ACTIVE" : "DISABLED")} dot>{active ? "Active" : "Inactive"}</Badge>,
                    },
                    {
                      label: "Sync status",
                      value: <Badge tone={toneForStatus(text(row, "sync_status", "syncStatus"))}>{text(row, "sync_status", "syncStatus")}</Badge>,
                    },
                    { label: "Updated", value: formatInstant(row.updated_at ?? row.updatedAt) },
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
