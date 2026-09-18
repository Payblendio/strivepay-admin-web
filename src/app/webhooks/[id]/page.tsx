import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconWebhook, IconId, IconCode } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { OpsShell } from "@/components/ops-shell";
import { WebhookEventActions } from "@/components/webhook-event-actions";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";
import { webhookHref, webhookProvider } from "@/lib/webhooks";

export const metadata: Metadata = { title: "Webhook event" };

export default async function WebhookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ provider?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const providerParam = Array.isArray(query.provider) ? query.provider[0] : query.provider;
  const { token, principal } = await requireAdmin(PERMISSIONS.webhooksView, `/webhooks/${id}`);
  const response = await adminBackend(token, `/v1/admin/webhooks/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  if (!response.ok) {
    return (
      <OpsShell principal={principal} eyebrow="Provider callbacks" title="Webhook event" copy={id}>
        <EmptyState title="Webhook unavailable" description="This webhook event could not be loaded. Refresh and try again." />
      </OpsShell>
    );
  }
  const row = asRecord(await responseBody(response));
  const provider = text(row, "provider_code", "providerCode") || webhookProvider(providerParam).value;
  const payload = text(row, "sanitized_payload", "sanitizedPayload");
  const status = text(row, "status");
  const eventType = text(row, "event_type", "eventType");

  return (
    <OpsShell principal={principal} eyebrow="Provider callbacks" title="Webhook event" copy={id}>
      <OpsDetailShell
        backHref={webhookHref(provider, "logs")}
        backLabel={`Back to ${webhookProvider(provider).label} logs`}
        headerTitle={(
          <OpsDetailTitle
            icon={<IconWebhook size={20} />}
            title={eventType === "—" ? "Webhook event" : eventType}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={id}
          />
        )}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Provider", value: provider },
              { label: "Status", value: status },
              { label: "Subtype", value: text(row, "event_subtype", "eventSubtype") },
              { label: "Attempts", value: text(row, "attempt_count", "attemptCount") },
            ]}
          />
        )}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <>
                <OpsDetailSection title="Inbox record">
                  <OpsDetailFacts
                    items={[
                      { label: "Provider", value: provider },
                      { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                      { label: "Type", value: eventType },
                      { label: "Subtype", value: text(row, "event_subtype", "eventSubtype") },
                      { label: "Provider transaction", value: text(row, "provider_transaction_id", "providerTransactionId") },
                      { label: "Attempts", value: text(row, "attempt_count", "attemptCount") },
                      { label: "Failure", value: text(row, "failure_reason", "failureReason", "provider_error", "providerError") },
                      { label: "Received", value: formatInstant(row.received_at ?? row.receivedAt) },
                      { label: "Processed", value: formatInstant(row.processed_at ?? row.processedAt) },
                    ]}
                  />
                </OpsDetailSection>
                <OpsDetailSection title="Actions">
                  <div className="ops-detail-actions">
                    <WebhookEventActions
                      id={id}
                      status={status}
                      canManage={hasPermission(principal.permissions, PERMISSIONS.webhooksManage)}
                    />
                  </div>
                </OpsDetailSection>
              </>
            ),
          },
          {
            id: "payload",
            label: "Payload",
            icon: <IconCode size={16} />,
            content: (
              <OpsDetailSection title="Sanitized payload">
                <pre className="ops-payload">{payload === "—" ? "No payload was stored." : payload}</pre>
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
