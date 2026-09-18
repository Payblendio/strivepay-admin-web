"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { adminFetch } from "@/lib/admin-session";
import { notifySuccess, promptReason } from "@/lib/swal";

export function WebhookEventActions({
  id,
  status,
  canManage,
}: {
  id: string;
  status: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  if (!canManage) return null;
  const value = status.toUpperCase();
  const retryable = value === "FAILED" || value === "UNKNOWN";
  const ignorable = retryable || value === "RECEIVED";
  if (!retryable && !ignorable) return null;

  async function act(action: "retry" | "ignore") {
    const reason = await promptReason({
      title: action === "retry" ? "Retry webhook" : "Ignore webhook",
      text: "This is written to the admin audit trail.",
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
    <div className="reason-actions">
      {retryable ? <Button type="button" variant="secondary" onClick={() => void act("retry")}>Retry</Button> : null}
      {ignorable ? <Button type="button" variant="quiet" onClick={() => void act("ignore")}>Ignore</Button> : null}
    </div>
  );
}
