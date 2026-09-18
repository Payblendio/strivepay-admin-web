"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Button } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { ViewLink } from "@/components/view-link";
import { useToast } from "@/components/ui/toast";
import { adminFetch } from "@/lib/admin-session";
import { promptReason, notifySuccess } from "@/lib/swal";
import { asRecord, formatInstant, text, toneForStatus } from "@/lib/values";
import { webhookProvider } from "@/lib/webhooks";

export function WebhookLogs({
  provider,
  rows,
  canManage,
}: {
  provider: string;
  rows: Record<string, unknown>[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();

  async function act(id: string, action: "retry" | "ignore") {
    const reason = await promptReason({
      title: action === "retry" ? "Retry webhook" : "Ignore webhook",
      text: action === "retry"
        ? "The worker will pick this event up again. Record why."
        : "This event will be marked processed and skipped. Record why.",
      confirmLabel: action === "retry" ? "Retry" : "Ignore",
    });
    if (!reason) return;
    const response = await adminFetch(`/api/admin/webhooks/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      show({ tone: "danger", title: data?.title ?? "The webhook could not be updated." });
      return;
    }
    await notifySuccess(action === "retry" ? "Retry queued" : "Webhook ignored");
    router.refresh();
  }

  return (
    <DataTable
      columns={[
        {
          key: "id",
          header: "Event",
          render: (row) => {
            const id = text(row, "id");
            return <Link className="ops-link" href={`/webhooks/${id}?provider=${provider}`}>{id.slice(0, 8)}…</Link>;
          },
        },
        { key: "type", header: "Type", render: (row) => text(row, "event_type", "eventType") },
        { key: "subtype", header: "Subtype", render: (row) => text(row, "event_subtype", "eventSubtype") },
        { key: "status", header: "Status", render: (row) => <Badge tone={toneForStatus(text(row, "status"))} dot>{text(row, "status")}</Badge> },
        { key: "attempts", header: "Attempts", render: (row) => text(row, "attempt_count", "attemptCount") },
        { key: "received", header: "Received", render: (row) => formatInstant(row.received_at ?? row.receivedAt) },
        {
          key: "details",
          header: "",
          render: (row) => (
            <ViewLink href={`/webhooks/${text(row, "id")}?provider=${provider}`} />
          ),
        },
        {
          key: "actions",
          header: "",
          render: (row) => {
            if (!canManage) return null;
            const status = text(row, "status").toUpperCase();
            const retryable = status === "FAILED" || status === "UNKNOWN";
            const ignorable = retryable || status === "RECEIVED";
            return (
              <span className="reason-actions">
                {retryable ? <Button size="small" variant="secondary" onClick={() => void act(text(row, "id"), "retry")}>Retry</Button> : null}
                {ignorable ? <Button size="small" variant="quiet" onClick={() => void act(text(row, "id"), "ignore")}>Ignore</Button> : null}
              </span>
            );
          },
        },
      ]}
      rows={rows.map(asRecord)}
      getKey={(row) => text(row, "id")}
      empty={<EmptyState compact title="No webhook events" description={`No ${webhookProvider(provider).label} inbox events match these filters.`} />}
    />
  );
}
