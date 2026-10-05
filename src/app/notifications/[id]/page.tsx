import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconId, IconMessage2, IconSend } from "@tabler/icons-react";
import { DeliveryRetryButton } from "@/components/delivery-retry-button";
import { NotificationChannelIcon } from "@/components/notification-channel-icon";
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
import { hasPermission, PERMISSIONS } from "@/lib/admin-access";
import { adminBackend, requireAdmin } from "@/lib/admin-session.server";
import { responseBody } from "@/lib/backend";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";

export const metadata: Metadata = { title: "Notification" };

function relatedHref(type: string, id: string) {
  if (id === "—") return null;
  const value = type.toUpperCase();
  if (value.includes("CONVERSION") || value.includes("TRANSACTION")) return `/transactions/${id}`;
  return null;
}

export default async function NotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, principal } = await requireAdmin(PERMISSIONS.notificationsView, `/notifications/${id}`);
  const canManage = hasPermission(principal.permissions, PERMISSIONS.notificationsManage);

  const response = await adminBackend(token, `/v1/admin/notifications/deliveries/${id}`);
  if (response.status === 400 || response.status === 404) notFound();
  const body = asRecord(await responseBody(response));
  const delivery = asRecord(body.delivery);
  if (!text(delivery, "id") || text(delivery, "id") === "—") notFound();
  const siblings = Array.isArray(body.deliveries) ? body.deliveries.map(asRecord) : [];

  const status = text(delivery, "status");
  const channel = text(delivery, "channel");
  const partyId = text(delivery, "partyId");
  const relatedType = text(delivery, "relatedType");
  const relatedId = text(delivery, "relatedId");
  const related = relatedHref(relatedType, relatedId);
  const lastError = text(delivery, "lastError");
  const isPush = channel === "PUSH";

  return (
    <OpsShell principal={principal} eyebrow="Platform" title="Notification" copy={`${channel} · ${status}`}>
      <OpsDetailShell
        backHref="/notifications"
        backLabel="Back to notifications"
        defaultTab="content"
        headerTitle={(
          <OpsDetailTitle
            icon={<NotificationChannelIcon channel={channel} size="md" />}
            title={text(delivery, "title")}
            status={<Badge tone={toneForStatus(status)} dot>{status}</Badge>}
            subtitle={`${text(delivery, "type")} · ${channel} · ${id}`}
          />
        )}
        headerActions={canManage && status.toUpperCase() === "FAILED"
          ? <DeliveryRetryButton path={`/api/admin/notifications/deliveries/${id}/retry`} />
          : undefined}
        sidebarSummary={(
          <OpsDetailSummary
            items={[
              { label: "Channel", value: channel },
              { label: "Status", value: status },
              { label: "Attempts", value: text(delivery, "attempts") },
              { label: "Category", value: text(delivery, "category") },
              { label: "Created", value: formatInstant(delivery.createdAt) },
              { label: "Delivered", value: formatInstant(delivery.deliveredAt) },
            ]}
          />
        )}
        tabs={[
          {
            id: "content",
            label: "Content",
            icon: <IconMessage2 size={16} />,
            content: (
              <OpsDetailSection title="Message" kicker="Content">
                <p className="ops-message-title">{text(delivery, "title")}</p>
                <pre className="ops-message-body">{text(delivery, "message")}</pre>
                {isPush ? (
                  <p className="ops-panel-copy" style={{ marginTop: "0.75rem" }}>
                    Push notifications show a shortened, lock-screen-safe version of this message.
                  </p>
                ) : null}
              </OpsDetailSection>
            ),
          },
          {
            id: "overview",
            label: "Overview",
            icon: <IconId size={16} />,
            content: (
              <OpsDetailSection title="Delivery" kicker="Overview">
                <OpsDetailFacts
                  items={[
                    { label: "Delivery id", value: text(delivery, "id") },
                    { label: "Notification id", value: text(delivery, "notificationId") },
                    {
                      label: "Customer",
                      value: partyId !== "—" ? <Link className="ops-link" href={`/customers/${partyId}`}>{partyId}</Link> : "—",
                    },
                    { label: "Type", value: text(delivery, "type") },
                    { label: "Category", value: text(delivery, "category") },
                    { label: "Channel", value: channel },
                    { label: "Recipient", value: text(delivery, "destination") },
                    ...(isPush ? [
                      { label: "Device platform", value: text(delivery, "devicePlatform") },
                      { label: "Device label", value: text(delivery, "deviceLabel") },
                    ] : []),
                    { label: "Status", value: <Badge tone={toneForStatus(status)} dot>{status}</Badge> },
                    { label: "Attempts", value: text(delivery, "attempts") },
                    { label: "Next attempt", value: status.toUpperCase() === "DELIVERED" ? "—" : formatInstant(delivery.nextAttemptAt) },
                    { label: "Delivered", value: formatInstant(delivery.deliveredAt) },
                    { label: "Related record", value: relatedType },
                    {
                      label: "Related id",
                      value: related ? <Link className="ops-link" href={related}>{relatedId}</Link> : relatedId,
                    },
                    { label: "Created", value: formatInstant(delivery.createdAt) },
                  ]}
                />
                {lastError !== "—" ? (
                  <>
                    <h3 className="ops-panel-heading" style={{ marginTop: "1.25rem" }}>Last error</h3>
                    <pre className="ops-message-body ops-cell-error">{lastError}</pre>
                  </>
                ) : null}
              </OpsDetailSection>
            ),
          },
          {
            id: "deliveries",
            label: "Deliveries",
            icon: <IconSend size={16} />,
            content: (
              <OpsDetailSection title="All channels" kicker="Deliveries">
                <DataTable
                  columns={[
                    {
                      key: "channel",
                      header: "Channel",
                      render: (row) => (
                        <span className="ops-tx-lead">
                          <NotificationChannelIcon channel={text(row, "channel")} />
                          {text(row, "id") === id ? text(row, "channel") : (
                            <Link className="ops-link" href={`/notifications/${text(row, "id")}`}>{text(row, "channel")}</Link>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: "recipient",
                      header: "Recipient",
                      render: (row) => <span className="ops-cell-truncate" title={text(row, "destination")}>{text(row, "destination")}</span>,
                    },
                    { key: "status", header: "Status", render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge> },
                    { key: "attempts", header: "Attempts", align: "center", render: (row) => text(row, "attempts") },
                    { key: "delivered", header: "Delivered", render: (row) => formatInstant(row.deliveredAt) },
                  ]}
                  rows={siblings}
                  getKey={(row) => text(row, "id")}
                  empty={<EmptyState compact title="No other deliveries" description="This notification was only sent on one channel." />}
                />
              </OpsDetailSection>
            ),
          },
        ]}
      />
    </OpsShell>
  );
}
