"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch } from "@/lib/admin-session";

export function PublishMajorRatesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  async function publish() {
    setMessage("");
    try {
      const response = await adminFetch("/api/admin/exchange-rates/daily-majors", { method: "POST" });
      if (!response.ok) {
        setMessage("Could not refresh the daily FX board.");
        return;
      }
      setMessage("Daily majors published.");
      startTransition(() => router.refresh());
    } catch {
      setMessage("Could not reach the admin API.");
    }
  }

  return (
    <div className="ops-fx-actions">
      <button className="sp-button secondary medium" type="button" disabled={pending} onClick={publish}>
        {pending ? "Publishing…" : "Publish daily majors"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
