import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlertTriangle } from "@tabler/icons-react";
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
import { relatedHref } from "@/lib/related-href";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Conversion alert" };

export default async function TreasuryAlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.treasuryView, `/treasury/alerts/${id}`);
  const response = await adminBackend(token, `/v1/admin/automatic-conversion-alerts/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Liquidity desk" title="Conversion alert" copy={id}>
        <EmptyState title="Conversion alert unavailable" description="This alert could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const status = text(row, "status");
  const severity = text(row, "severity");
  const relatedType = text(row, "related_type", "relatedType");
  const relatedId = text(row, "related_id", "relatedId");
  const relatedLink = relatedHref(relatedType, relatedId);

  return (
    <OpsShell principal={principal} eyebrow="Liquidity desk" title="Conversion alert" copy={text(row, "title")}>
      <OpsDetailShell
        backHref="/treasury"
        backLabel="Back to treasury"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconAlertTriangle size={20} />}
            title={text(row, "title")}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Severity", value: severity },
              { label: "Type", value: text(row, "type", "alert_type", "alertType") },
              {
                label: "Related",
                value: relatedLink ? (
                  <Link className="ops-link" href={relatedLink}>{`${relatedType} · ${relatedId}`}</Link>
                ) : `${relatedType} · ${relatedId}`,
              },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <OpsDetailSection title="Alert" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Alert id", value: text(row, "id") },
                    { label: "Type", value: text(row, "type", "alert_type", "alertType") },
                    { label: "Severity", value: <Badge tone={toneForStatus(severity)}>{severity}</Badge> },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Title", value: text(row, "title") },
                    { label: "Message", value: text(row, "message") },
                    { label: "Related type", value: relatedType },
                    {
                      label: "Related id",
                      value: relatedLink ? <Link className="ops-link" href={relatedLink}>{relatedId}</Link> : relatedId,
                    },
                    { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
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
