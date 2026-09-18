import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconRefresh } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { DeliveryRetryButton } from "@/components/delivery-retry-button";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Fee synchronization" };

export default async function FeeSyncDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.feesView, `/fees/synchronizations/${id}`);
  const canManage = hasPermission(principal.permissions, PERMISSIONS.feesManage);
  const response = await adminBackend(token, `/v1/admin/fees/synchronizations/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Pricing desk" title="Fee synchronization" copy={id}>
        <EmptyState title="Sync job unavailable" description="This fee synchronization could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  if (!text(row, "id") || text(row, "id") === "—") notFound();

  const status = text(row, "status");
  const ruleId = text(row, "fee_rule_id", "feeRuleId");
  const retryable = ["FAILED", "DEAD"].includes(status.toUpperCase());

  return (
    <OpsShell principal={principal} eyebrow="Pricing desk" title="Fee synchronization" copy={id}>
      <OpsDetailShell
        backHref="/fees"
        backLabel="Back to fees"
        headerTitle={(
          <OpsDetailTitle
            icon={<IconRefresh size={20} />}
            title={text(row, "action")}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        headerActions={canManage && retryable ? (
          <DeliveryRetryButton path={`/api/admin/fees/synchronizations/${id}/retry`} label="Retry sync" />
        ) : undefined}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Status", value: status },
              { label: "Attempts", value: text(row, "attempt_count", "attemptCount") },
              {
                label: "Fee rule",
                value: ruleId === "—" ? "—" : <Link className="ops-link" href={`/fees/${ruleId}`}>{ruleId}</Link>,
              },
              { label: "Created", value: formatInstant(row.created_at ?? row.createdAt) },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <OpsDetailSection title="Sync job" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Job id", value: text(row, "id") },
                    {
                      label: "Fee rule",
                      value: ruleId === "—" ? "—" : <Link className="ops-link" href={`/fees/${ruleId}`}>{ruleId}</Link>,
                    },
                    { label: "Action", value: text(row, "action") },
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Attempts", value: text(row, "attempt_count", "attemptCount") },
                    { label: "Next attempt", value: formatInstant(row.next_attempt_at ?? row.nextAttemptAt) },
                    { label: "Last attempt", value: formatInstant(row.last_attempt_at ?? row.lastAttemptAt) },
                    { label: "Last error", value: text(row, "last_error", "lastError") },
                    { label: "Completed", value: formatInstant(row.completed_at ?? row.completedAt) },
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
