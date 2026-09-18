"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";

type Alert = { id: string; title?: string; severity?: string; status?: string };

export function RuntimeAlertsPanel({
  alerts,
  canAck,
}: {
  alerts: Alert[];
  canAck: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function acknowledge(alert: Alert) {
    setMessage("");
    const reason = await promptReason({
      title: "Acknowledge operational alert",
      text: alert.title
        ? `Confirm you have reviewed “${alert.title}”.`
        : "Confirm you have reviewed this runtime alert.",
      confirmLabel: "Acknowledge",
    });
    if (!reason) return;
    const response = await adminFetch(`/api/admin/runtime/operational-alerts/${alert.id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setMessage(data?.title ?? "Acknowledge failed.");
      return;
    }
    router.refresh();
  }

  const openAlerts = alerts.filter((alert) => String(alert.status || "").toUpperCase() !== "ACKNOWLEDGED");

  return (
    <div className="ops-stack">
      {openAlerts.length === 0 ? <p className="ops-panel-copy">No open operational alerts.</p> : null}
      {message ? <small className="ops-inline-note">{message}</small> : null}
      <div className="ops-inline-actions">
        {openAlerts.map((alert) => (
          <div key={alert.id} className="ops-inline-note">
            <strong>{alert.severity || "ALERT"}</strong> {alert.title || alert.id.slice(0, 8)}
            {canAck ? (
              <Button
                size="small"
                variant="secondary"
                onClick={() => void acknowledge(alert)}
              >
                Acknowledge
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
