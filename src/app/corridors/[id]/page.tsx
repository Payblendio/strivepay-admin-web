import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconRoute } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { Badge } from "@/components/ui/primitives";
import { PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatAmount, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Corridor" };

export default async function CorridorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.coverageView, `/corridors/${id}`);
  const response = await adminBackend(token, `/v1/admin/corridors/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const enabled = row.enabled === true || row.enabled === "true";
  const cert = text(row, "certification_status", "certificationStatus");
  const source = text(row, "source_asset", "sourceAsset", "source_asset_code");
  const destination = text(row, "destination_asset", "destinationAsset", "destination_asset_code");
  const route = `${source} → ${destination}`;

  return (
    <OpsShell principal={principal} eyebrow="Coverage" title="Corridor" copy={route}>
      <OpsDetailShell
        backHref="/corridors"
        backLabel="Back to corridors"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconRoute size={20} />}
            title={route}
            status={<Badge tone={toneForStatus(cert)} dot>{cert}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Environment", value: text(row, "environment") },
              { label: "Direction", value: text(row, "direction") },
              { label: "Network", value: text(row, "network") },
              { label: "Enabled", value: enabled ? "Yes" : "No" },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <OpsDetailSection title="Corridor" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Corridor id", value: text(row, "id") },
                    { label: "Environment", value: text(row, "environment") },
                    { label: "Direction", value: text(row, "direction") },
                    { label: "Source asset", value: source },
                    { label: "Destination asset", value: destination },
                    { label: "Network", value: text(row, "network") },
                    {
                      label: "Certification",
                      value: <Badge tone={toneForStatus(cert)} dot>{cert}</Badge>,
                    },
                    { label: "Certification evidence", value: text(row, "certification_evidence", "certificationEvidence") },
                    { label: "Certified at", value: formatInstant(row.certified_at ?? row.certifiedAt) },
                    {
                      label: "Enabled",
                      value: <Badge tone={toneForStatus(enabled ? "ACTIVE" : "DISABLED")}>{enabled ? "Yes" : "No"}</Badge>,
                    },
                    {
                      label: "Max transaction",
                      value: formatAmount(row.maximum_transaction_amount ?? row.maximumTransactionAmount, source),
                    },
                    {
                      label: "Rolling day count limit",
                      value: text(row, "rolling_day_transaction_limit", "rollingDayTransactionLimit"),
                    },
                    {
                      label: "Rolling day amount limit",
                      value: formatAmount(row.rolling_day_source_amount_limit ?? row.rollingDaySourceAmountLimit, source),
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
