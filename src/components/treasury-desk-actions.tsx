"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AmountFields, ReasonModal } from "@/components/reason-modal";
import { Button, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";

type Task = {
  id: string;
  conversionId?: string;
  type?: string;
  status?: string;
  asset?: string;
  actionRequired?: string;
};

type Alert = {
  id: string;
  title?: string;
  status?: string;
  relatedType?: string;
  relatedId?: string;
};

type Cost = {
  id: string;
  type?: string;
  provider?: string;
  asset?: string;
  quotedAmount?: string;
  actualAmount?: string;
  valuationAmount?: string;
  status?: string;
};

export function TreasuryDeskActions({
  canManage,
  tasks,
  alerts,
}: {
  canManage: boolean;
  tasks: Task[];
  alerts: Alert[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"evidence" | "value" | null>(null);
  const [taskId, setTaskId] = useState("");
  const [conversionId, setConversionId] = useState("");
  const [costId, setCostId] = useState("");
  const [costs, setCosts] = useState<Cost[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [evidenceReference, setEvidenceReference] = useState("");
  const [fundedAmount, setFundedAmount] = useState("");
  const [evidencedCostAmount, setEvidencedCostAmount] = useState("");
  const [evidencedCostAsset, setEvidencedCostAsset] = useState("NGN");
  const [valuationNgn, setValuationNgn] = useState("");
  const [valueEvidence, setValueEvidence] = useState("");

  const selectedCost = useMemo(
    () => costs.find((cost) => cost.id === costId) ?? null,
    [costId, costs],
  );

  if (!canManage) return null;

  async function openCosts(relatedId: string) {
    setConversionId(relatedId);
    setCostId("");
    setCosts([]);
    setValuationNgn("");
    setValueEvidence("");
    setError("");
    setMessage("");
    const response = await adminFetch(`/api/admin/automatic-conversions/${relatedId}/costs`);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setMessage(data?.title ?? "Could not load conversion costs.");
      return;
    }
    const payload = await response.json().catch(() => []) as Cost[];
    setCosts(Array.isArray(payload) ? payload : []);
    setMode("value");
  }

  async function acknowledgeAlert(id: string, title?: string) {
    setMessage("");
    const reason = await promptReason({
      title: "Acknowledge conversion alert",
      text: title ? `Record why you are acknowledging “${title}”.` : "Record why you are acknowledging this alert.",
      confirmLabel: "Acknowledge",
    });
    if (!reason) return;
    const response = await adminFetch(`/api/admin/automatic-conversion-alerts/${id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setMessage(data?.title ?? "Acknowledge failed.");
      return;
    }
    setMessage("Alert acknowledged.");
    router.refresh();
  }

  async function confirm(reason: string) {
    if (!mode) return;
    if (mode === "value" && !valueEvidence.trim()) {
      setError("Evidence reference is required.");
      return;
    }
    setBusy(true);
    setError("");
    let response: Response;
    if (mode === "evidence") {
      response = await adminFetch(`/api/admin/treasury/tasks/${taskId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceReference,
          reason,
          fundedAmount: fundedAmount.trim() || null,
          evidencedCostAmount: evidencedCostAmount.trim() || null,
          evidencedCostAsset: evidencedCostAsset.trim() || null,
        }),
      });
    } else {
      response = await adminFetch(`/api/admin/automatic-conversions/${conversionId}/costs/${costId}/valuation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valuationNgn,
          evidenceReference: valueEvidence.trim(),
          reason,
        }),
      });
    }
    setBusy(false);
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "The treasury action failed.");
      return;
    }
    setMode(null);
    setMessage("Treasury update saved.");
    router.refresh();
  }

  const openTasks = tasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(String(task.status || "").toUpperCase()));
  const openAlerts = alerts.filter((alert) => String(alert.status || "").toUpperCase() !== "ACKNOWLEDGED");

  return (
    <div className="ops-stack">
      {message ? <small className="ops-inline-note">{message}</small> : null}
      <div className="ops-inline-actions">
        {openTasks.slice(0, 10).map((task) => (
          <Button
            key={task.id}
            size="small"
            variant="secondary"
            onClick={() => {
              setTaskId(task.id);
              setEvidenceReference("");
              setFundedAmount("");
              setEvidencedCostAmount("");
              setError("");
              setMode("evidence");
            }}
          >
            Evidence {task.type || task.id.slice(0, 8)}
          </Button>
        ))}
        {openAlerts.slice(0, 8).map((alert) => (
          <Button
            key={alert.id}
            size="small"
            variant="quiet"
            onClick={() => void acknowledgeAlert(alert.id, alert.title)}
          >
            Ack alert {alert.title || alert.id.slice(0, 8)}
          </Button>
        ))}
        {alerts.filter((alert) => String(alert.relatedType || "").toUpperCase().includes("CONVERSION") && alert.relatedId).slice(0, 6).map((alert) => (
          <Button
            key={`cost-${alert.id}`}
            size="small"
            variant="quiet"
            onClick={() => void openCosts(String(alert.relatedId))}
          >
            Value costs {String(alert.relatedId).slice(0, 8)}…
          </Button>
        ))}
        {openTasks.filter((task) => task.conversionId).slice(0, 6).map((task) => (
          <Button
            key={`task-cost-${task.id}`}
            size="small"
            variant="quiet"
            onClick={() => void openCosts(String(task.conversionId))}
          >
            Value conversion {String(task.conversionId).slice(0, 8)}…
          </Button>
        ))}
      </div>

      <ReasonModal
        open={mode === "evidence"}
        title="Submit funding evidence"
        description="Attach evidence for a DOT or funding treasury task."
        confirmLabel="Submit evidence"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            <TextField label="Evidence reference" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} required />
            <TextField label="Funded amount" value={fundedAmount} onChange={(event) => setFundedAmount(event.target.value)} inputMode="decimal" />
            <AmountFields
              currency={evidencedCostAsset}
              amount={evidencedCostAmount}
              onCurrency={setEvidencedCostAsset}
              onAmount={setEvidencedCostAmount}
            />
          </div>
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />

      <ReasonModal
        open={mode === "value"}
        title="Value automatic conversion cost"
        description="Review the provider cost, then record its NGN valuation."
        confirmLabel="Save valuation"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            <p className="ops-panel-copy">Conversion <span className="ops-mono">{conversionId || "—"}</span></p>
            <label className="sp-field"><span>Cost</span>
              <select value={costId} onChange={(event) => setCostId(event.target.value)} required>
                <option value="">Choose cost</option>
                {costs.map((cost) => (
                  <option key={cost.id} value={cost.id}>
                    {(cost.type || "COST")} · {cost.provider || "—"} · {cost.asset || "—"} · {cost.status || "—"}
                  </option>
                ))}
              </select>
            </label>
            {selectedCost ? (
              <dl className="ops-cost-facts">
                <div><dt>Type</dt><dd>{selectedCost.type || "—"}</dd></div>
                <div><dt>Provider</dt><dd>{selectedCost.provider || "—"}</dd></div>
                <div><dt>Asset</dt><dd>{selectedCost.asset || "—"}</dd></div>
                <div><dt>Status</dt><dd>{selectedCost.status || "—"}</dd></div>
                <div><dt>Quoted amount</dt><dd>{selectedCost.quotedAmount || "—"}</dd></div>
                <div><dt>Actual amount</dt><dd>{selectedCost.actualAmount || "—"}</dd></div>
                <div><dt>Existing valuation</dt><dd>{selectedCost.valuationAmount || "—"}</dd></div>
                <div><dt>Cost id</dt><dd className="ops-mono">{selectedCost.id}</dd></div>
              </dl>
            ) : (
              <p className="ops-panel-copy">Select a cost to see type, provider, asset, and amounts before valuing.</p>
            )}
            <TextField label="Valuation NGN" value={valuationNgn} onChange={(event) => setValuationNgn(event.target.value)} inputMode="decimal" required />
            <TextField label="Evidence reference" value={valueEvidence} onChange={(event) => setValueEvidence(event.target.value)} required />
          </div>
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />
    </div>
  );
}
