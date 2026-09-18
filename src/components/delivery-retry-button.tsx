"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";

export function DeliveryRetryButton({
  path,
  label = "Retry",
}: {
  path: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setError("");
    const reason = await promptReason({
      title: "Retry delivery",
      text: "Requeues this delivery for another attempt.",
      confirmLabel: "Retry",
    });
    if (!reason) return;
    setBusy(true);
    const response = await adminFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "Retry failed.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <Button size="small" variant="secondary" loading={busy} onClick={() => void retry()}>{label}</Button>
      {error ? <small className="ops-inline-note">{error}</small> : null}
    </>
  );
}
