"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AmountFields, ReasonModal } from "@/components/reason-modal";
import { Badge, Button } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import type { TransactionEconomics } from "@/lib/admin-types";
import { formatAmount, toneForStatus } from "@/lib/values";

export function TransactionEconomicsPanel({
  transactionId,
  initial,
  canManage,
}: {
  transactionId: string;
  initial: TransactionEconomics | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [economics, setEconomics] = useState(initial);
  const [action, setAction] = useState<{ costId: string; kind: "valuation" | "actual" } | null>(null);
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!economics) {
    return <p>Economics are not available for this record. It may not be linked to an order yet.</p>;
  }

  async function confirm(reason: string) {
    if (!action) return;
    setBusy(true);
    setError("");
    const path = action.kind === "valuation"
      ? `/api/admin/transactions/${transactionId}/costs/${action.costId}/valuation`
      : `/api/admin/transactions/${transactionId}/costs/${action.costId}/actual`;
    const response = await adminFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency, amount, reason }),
    });
    const data = await response.json().catch(() => null) as TransactionEconomics & { title?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data?.title ?? "The cost could not be updated.");
      return;
    }
    setEconomics(data);
    setAction(null);
    setCurrency("");
    setAmount("");
    router.refresh();
  }

  return (
    <div className="ops-stack">
      <div>
        <p className="ops-panel-copy">Realized profit</p>
        <h3>{economics.realizedProfit != null ? String(economics.realizedProfit) : "—"}</h3>
        <p>
          Valuation <Badge tone={toneForStatus(economics.valuationStatus)}>{economics.valuationStatus}</Badge>
        </p>
      </div>

      {economics.fee ? (
        <p>
          Platform fee {formatAmount(economics.fee.chargedAmount, economics.fee.feeAsset)}
          {economics.fee.direction ? ` · ${economics.fee.direction}` : ""}
          {economics.fee.paymentMethod ? ` · ${economics.fee.paymentMethod}` : ""}
          {economics.fee.status ? ` · ${economics.fee.status}` : ""}
        </p>
      ) : <p>No platform fee snapshot is attached.</p>}

      <div>
        <p className="ops-panel-copy">Provider & operating costs</p>
        {(economics.costs ?? []).length === 0 ? (
          <p>No cost lines recorded yet.</p>
        ) : (
          (economics.costs ?? []).map((cost) => (
            <div className="ops-cost-row" key={cost.id}>
              <div>
                <strong>{cost.type}</strong>
                <div><Badge tone={toneForStatus(cost.status)}>{cost.status}</Badge></div>
              </div>
              <span>Asset {cost.asset || "—"}</span>
              <span>Actual {formatAmount(cost.actualAmount, cost.asset)}</span>
              <span>Valuation {formatAmount(cost.valuationAmount, cost.valuationCurrency)}</span>
              {canManage ? (
                <span className="reason-actions">
                  <Button size="small" variant="secondary" onClick={() => { setAction({ costId: cost.id, kind: "valuation" }); setError(""); }}>
                    Valuation
                  </Button>
                  <Button size="small" variant="secondary" onClick={() => { setAction({ costId: cost.id, kind: "actual" }); setError(""); }}>
                    Actual
                  </Button>
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>

      <ReasonModal
        open={Boolean(action)}
        title={action?.kind === "actual" ? "Record actual cost" : "Record cost valuation"}
        description="This is written to the admin audit trail."
        confirmLabel="Save"
        busy={busy}
        error={error}
        extraFields={<AmountFields currency={currency} amount={amount} onCurrency={setCurrency} onAmount={setAmount} />}
        onClose={() => { if (!busy) setAction(null); }}
        onConfirm={confirm}
      />
    </div>
  );
}
