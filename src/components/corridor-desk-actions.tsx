"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonModal } from "@/components/reason-modal";
import { Button, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";

type Corridor = {
  id: string;
  environment?: string;
  direction?: string;
  sourceAsset?: string;
  destinationAsset?: string;
  network?: string;
  certificationStatus?: string;
};

export function CorridorDeskActions({
  canManage,
  corridors,
}: {
  canManage: boolean;
  corridors: Corridor[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"upsert" | "certify" | null>(null);
  const [corridorId, setCorridorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [environment, setEnvironment] = useState("SANDBOX");
  const [direction, setDirection] = useState("FIAT_TO_CRYPTO");
  const [sourceAsset, setSourceAsset] = useState("USD");
  const [destinationAsset, setDestinationAsset] = useState("USDC");
  const [network, setNetwork] = useState("POLYGON");
  const [maximumTransactionAmount, setMaximumTransactionAmount] = useState("");
  const [rollingDayTransactionLimit, setRollingDayTransactionLimit] = useState("");
  const [rollingDaySourceAmountLimit, setRollingDaySourceAmountLimit] = useState("");
  const [passed, setPassed] = useState(true);
  const [evidence, setEvidence] = useState("");

  if (!canManage) return null;

  async function confirm(reason: string) {
    if (!mode) return;
    if (mode === "upsert") {
      if (!maximumTransactionAmount.trim() || !rollingDayTransactionLimit.trim() || !rollingDaySourceAmountLimit.trim()) {
        setError("Max amount and both rolling-day limits are required.");
        return;
      }
    }
    setBusy(true);
    setError("");
    const response = mode === "upsert"
      ? await adminFetch("/api/admin/corridors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            environment,
            direction,
            sourceAsset,
            destinationAsset,
            network,
            maximumTransactionAmount: maximumTransactionAmount.trim(),
            rollingDayTransactionLimit: rollingDayTransactionLimit.trim(),
            rollingDaySourceAmountLimit: rollingDaySourceAmountLimit.trim(),
            reason,
          }),
        })
      : await adminFetch(`/api/admin/corridors/${corridorId}/certification`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passed, evidence, reason }),
        });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
      setError(data?.detail ?? data?.title ?? "Corridor update failed.");
      return;
    }
    setMode(null);
    router.refresh();
  }

  return (
    <div className="ops-stack">
      <div className="reason-actions">
        <Button size="small" variant="secondary" onClick={() => { setError(""); setMode("upsert"); }}>Configure corridor</Button>
      </div>
      <div className="ops-inline-actions">
        {corridors.slice(0, 12).map((corridor) => (
          <Button
            key={corridor.id}
            size="small"
            variant="quiet"
            onClick={() => {
              setCorridorId(corridor.id);
              setEvidence("");
              setPassed(true);
              setError("");
              setMode("certify");
            }}
          >
            Certify {corridor.sourceAsset}/{corridor.destinationAsset}
          </Button>
        ))}
      </div>

      <ReasonModal
        open={mode === "upsert"}
        title="Configure corridor"
        description="Set limits and routing for a settlement corridor."
        confirmLabel="Save corridor"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            <label className="sp-field"><span>Environment</span>
              <select value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option value="SANDBOX">SANDBOX</option>
                <option value="PRODUCTION">PRODUCTION</option>
              </select>
            </label>
            <label className="sp-field"><span>Direction</span>
              <select value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="FIAT_TO_CRYPTO">FIAT_TO_CRYPTO</option>
                <option value="CRYPTO_TO_FIAT">CRYPTO_TO_FIAT</option>
              </select>
            </label>
            <TextField label="Source asset" value={sourceAsset} onChange={(event) => setSourceAsset(event.target.value)} />
            <TextField label="Destination asset" value={destinationAsset} onChange={(event) => setDestinationAsset(event.target.value)} />
            <TextField label="Network" value={network} onChange={(event) => setNetwork(event.target.value)} />
            <TextField label="Max transaction amount" value={maximumTransactionAmount} onChange={(event) => setMaximumTransactionAmount(event.target.value)} required />
            <TextField label="Rolling day transaction limit" value={rollingDayTransactionLimit} onChange={(event) => setRollingDayTransactionLimit(event.target.value)} required />
            <TextField label="Rolling day source amount limit" value={rollingDaySourceAmountLimit} onChange={(event) => setRollingDaySourceAmountLimit(event.target.value)} required />
          </div>
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />

      <ReasonModal
        open={mode === "certify"}
        title="Certify corridor"
        description="Record a certification decision with evidence."
        confirmLabel="Save certification"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            <label className="sp-field"><span>Passed</span>
              <select value={passed ? "true" : "false"} onChange={(event) => setPassed(event.target.value === "true")}>
                <option value="true">Passed</option>
                <option value="false">Failed</option>
              </select>
            </label>
            <TextField label="Evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} required />
          </div>
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />
    </div>
  );
}
