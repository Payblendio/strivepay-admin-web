"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PartySearchField } from "@/components/party-search-field";
import { ReasonModal } from "@/components/reason-modal";
import { Button, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { confirmAction, notifySuccess, promptReason } from "@/lib/swal";

/** Bakkt merchant fee fiat codes — https://docs.bakkt.com/reference/patch_stablecoin-merchant-fees */
const BAKKT_FIAT = [
  "USD", "EUR", "GBP", "CAD", "SGD",
  "NGN", "INR", "PKR", "MXN", "BRL", "ARS", "TRY",
  "IDR", "PHP", "VND", "COP", "JPY",
  "GHS", "KES", "ZMW", "UGX", "TZS", "XOF", "XAF", "GTQ",
  "AED", "OMR", "QAR", "NPR",
] as const;

const BAKKT_FIAT_PRIMARY = ["USD", "EUR", "GBP", "CAD"] as const;

const BAKKT_PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any" },
  { value: "ACH", label: "ACH" },
  { value: "WIRE", label: "WIRE" },
  { value: "INT_WIRE", label: "INT_WIRE" },
  { value: "SEPA", label: "SEPA" },
  { value: "SEPA_INSTANT", label: "SEPA Instant" },
  { value: "FASTER_PAYMENTS", label: "Faster Payments" },
  { value: "SWIFT", label: "SWIFT" },
  { value: "NIBSS", label: "NIBSS" },
  { value: "IMPS", label: "IMPS" },
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "SPEI", label: "SPEI" },
  { value: "PIX", label: "PIX" },
  { value: "FAST_TRY", label: "FAST_TRY" },
  { value: "BI_FAST", label: "BI_FAST" },
  { value: "ALIPAY", label: "Alipay" },
  { value: "INSTAPAY", label: "InstaPay" },
  { value: "CITAD", label: "CITAD" },
];

function stableForFiat(fiat: string) {
  switch (fiat) {
    case "EUR":
      return "EURC";
    case "GBP":
      return "GBPT";
    default:
      return "USDC";
  }
}

function ruleAssetsFromBakkt(bakktDirection: "ONRAMP" | "OFFRAMP", inputCurrency: string, outputCurrency: string) {
  if (bakktDirection === "ONRAMP") {
    return {
      direction: "FIAT_TO_CRYPTO",
      sourceAsset: inputCurrency,
      destinationAsset: stableForFiat(outputCurrency),
      feeAsset: inputCurrency,
    };
  }
  return {
    direction: "CRYPTO_TO_FIAT",
    sourceAsset: stableForFiat(inputCurrency),
    destinationAsset: outputCurrency,
    feeAsset: outputCurrency,
  };
}

/** Fee % field is always percent (0.75 → 0.0075). Never treat ≤1 as a fraction. */
function toStoredRate(percentInput: string) {
  const raw = Number(percentInput);
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw / 100;
}

function toPercentDisplay(stored: string | number | undefined) {
  if (stored == null || stored === "") return "2";
  const n = Number(stored);
  if (!Number.isFinite(n)) return "2";
  return String(Math.round(n * 10000) / 100);
}

function FieldSelect({
  label,
  value,
  onChange,
  children,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="sp-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {hint ? <small className="ops-inline-note">{hint}</small> : null}
    </label>
  );
}

function CurrencyOptions() {
  return (
    <>
      <optgroup label="Common">
        {BAKKT_FIAT_PRIMARY.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </optgroup>
      <optgroup label="All Bakkt currencies">
        {BAKKT_FIAT.filter((code) => !(BAKKT_FIAT_PRIMARY as readonly string[]).includes(code)).map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </optgroup>
    </>
  );
}

export function FeesDeskActions({
  canManage,
  ngnMarkup,
  tab,
}: {
  canManage: boolean;
  ngnMarkup: { markupPercent?: string | number; updatedAt?: string } | null;
  tab: "bakkt" | "ngn" | "fx" | "sync";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"fee" | "fx" | "ngn" | "purge" | null>(null);
  const [scopeType, setScopeType] = useState<"GLOBAL" | "PARTY">("GLOBAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [scopeId, setScopeId] = useState("");
  const [bakktDirection, setBakktDirection] = useState<"ONRAMP" | "OFFRAMP">("ONRAMP");
  const [inputCurrency, setInputCurrency] = useState("USD");
  const [outputCurrency, setOutputCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] = useState("ACH");
  const [feeOpType, setFeeOpType] = useState<"add" | "subtract">("add");
  const [percentagePercent, setPercentagePercent] = useState("2");
  const [minimumAmount, setMinimumAmount] = useState("");

  const [ngnPercent, setNgnPercent] = useState(toPercentDisplay(ngnMarkup?.markupPercent));
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("NGN");
  const [rate, setRate] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [evidenceReference, setEvidenceReference] = useState("");

  if (!canManage) return null;

  function openFee(scope: "GLOBAL" | "PARTY") {
    setError("");
    setScopeType(scope);
    setScopeId("");
    setBakktDirection("ONRAMP");
    setInputCurrency("USD");
    setOutputCurrency("USD");
    setPaymentMethod(scope === "GLOBAL" ? "ACH" : "");
    setFeeOpType("add");
    setPercentagePercent("2");
    setMinimumAmount("");
    setMode("fee");
  }

  async function confirm(reason: string) {
    if (!mode) return;
    if (mode === "fee" && scopeType === "PARTY" && !scopeId.trim()) {
      setError("Select a party by name or email.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let response: Response;
    if (mode === "fee") {
      const percentageRate = toStoredRate(percentagePercent);
      if (percentageRate == null) {
        setBusy(false);
        setError("Enter a valid fee % (e.g. 2).");
        return;
      }
      const assets = ruleAssetsFromBakkt(bakktDirection, inputCurrency, outputCurrency);
      response = await adminFetch("/api/admin/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType,
          scopeId: scopeType === "PARTY" ? scopeId.trim() : null,
          direction: assets.direction,
          sourceAsset: assets.sourceAsset,
          destinationAsset: assets.destinationAsset,
          paymentMethod: paymentMethod.trim() || null,
          percentageRate,
          fixedAmount: null,
          minimumAmount: minimumAmount.trim() || null,
          feeAsset: assets.feeAsset,
          feeOpType,
          reason,
        }),
      });
      setBusy(false);
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
        setError(data?.detail ?? data?.title ?? "Bakkt sync failed.");
        return;
      }
      const saved = await response.json().catch(() => null) as {
        syncStatus?: string;
        bakktDirection?: string;
        percentageRate?: number;
      } | null;
      const sync = (saved?.syncStatus || "").toUpperCase();
      const pct = Math.round(Number(saved?.percentageRate ?? percentageRate) * 10000) / 100;
      const directionLabel = saved?.bakktDirection ?? bakktDirection;
      setMode(null);
      const feedback =
        sync === "SYNCED"
          ? `Synced to Bakkt · ${directionLabel} · ${pct}%`
          : sync === "LOCAL_ONLY"
            ? "Saved locally only (Bakkt mode is SIMULATOR)."
            : sync === "FAILED"
              ? "Saved, but Bakkt rejected the fee. Open the Sync tab."
              : sync === "PENDING"
                ? "Saved and queued for Bakkt. Refresh if sync stays Pending."
                : `Fee saved (${sync || "unknown sync status"}).`;
      setMessage(feedback);
      await notifySuccess(sync === "SYNCED" ? "Synced to Bakkt" : "Fee saved", feedback);
      router.refresh();
      return;
    }
    if (mode === "ngn") {
      const markupPercent = toStoredRate(ngnPercent);
      if (markupPercent == null) {
        setBusy(false);
        setError("Enter a valid markup %.");
        return;
      }
      response = await adminFetch("/api/admin/fees/ngn-markup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markupPercent, reason }),
      });
    } else if (mode === "purge") {
      response = await adminFetch("/api/admin/fees/simulator/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } else {
      response = await adminFetch("/api/admin/exchange-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency,
          quoteCurrency,
          rate,
          source,
          evidenceReference: evidenceReference.trim() || null,
          observedAt: null,
          expiresAt: null,
          reason,
        }),
      });
    }
    setBusy(false);
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => null) as { title?: string } | null;
      setError(data?.title ?? "The change could not be saved.");
      return;
    }
    setMode(null);
    setMessage(mode === "fx" ? "FX rate saved." : mode === "ngn" ? "NGN markup saved." : "Simulator fee clutter cleared.");
    router.refresh();
  }

  return (
    <div className="ops-stack">
      {tab === "bakkt" ? (
        <div className="reason-actions">
          <Button size="small" variant="secondary" onClick={() => openFee("GLOBAL")}>Add merchant fee</Button>
          <Button size="small" variant="secondary" onClick={() => openFee("PARTY")}>Add party fee</Button>
        </div>
      ) : null}
      {tab === "ngn" ? (
        <div className="reason-actions">
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              setError("");
              setNgnPercent(toPercentDisplay(ngnMarkup?.markupPercent));
              setMode("ngn");
            }}
          >
            Edit NGN markup
          </Button>
        </div>
      ) : null}
      {tab === "fx" ? (
        <div className="reason-actions">
          <Button size="small" variant="secondary" onClick={() => { setError(""); setMode("fx"); }}>Publish FX rate</Button>
        </div>
      ) : null}
      {tab === "sync" ? (
        <div className="reason-actions">
          <Button size="small" variant="quiet" onClick={() => { setError(""); setMode("purge"); }}>Clear simulator fee records</Button>
        </div>
      ) : null}
      {message ? <small className="ops-inline-note">{message}</small> : null}

      {mode === "fee" ? (
      <ReasonModal
        open
        title={scopeType === "GLOBAL" ? "Merchant fee (Bakkt)" : "Party fee (Bakkt)"}
        description="Saves and PATCHes Bakkt immediately. Use add to take StrivePay revenue."
        confirmLabel="Save & sync"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            {scopeType === "PARTY" ? (
              <PartySearchField value={scopeId} onChange={(partyId) => setScopeId(partyId)} />
            ) : null}
            <FieldSelect label="Direction" value={bakktDirection} onChange={(value) => setBakktDirection(value as "ONRAMP" | "OFFRAMP")}>
              <option value="ONRAMP">ONRAMP (buy)</option>
              <option value="OFFRAMP">OFFRAMP (sell)</option>
            </FieldSelect>
            <FieldSelect
              label="Input currency"
              value={inputCurrency}
              onChange={setInputCurrency}
              hint={bakktDirection === "OFFRAMP" ? "Token peg (USD = USDT/USDC)." : "Fiat paid."}
            >
              <CurrencyOptions />
            </FieldSelect>
            <FieldSelect
              label="Output currency"
              value={outputCurrency}
              onChange={setOutputCurrency}
              hint={bakktDirection === "ONRAMP" ? "Token peg (USD = USDT/USDC)." : "Fiat received."}
            >
              <CurrencyOptions />
            </FieldSelect>
            <FieldSelect label="Payment method" value={paymentMethod} onChange={setPaymentMethod}>
              {BAKKT_PAYMENT_METHODS.map((method) => (
                <option key={method.value || "any"} value={method.value}>{method.label}</option>
              ))}
            </FieldSelect>
            <FieldSelect label="Fee op type" value={feeOpType} onChange={(value) => setFeeOpType(value as "add" | "subtract")}>
              <option value="add">add (take fee)</option>
              <option value="subtract">subtract</option>
            </FieldSelect>
            <TextField label="Fee %" value={percentagePercent} onChange={(event) => setPercentagePercent(event.target.value)} inputMode="decimal" hint="0.75 = 0.75% (Bakkt fee=0.0075). 2 = 2%." />
            <TextField
              label={`Minimum fee (${bakktDirection === "ONRAMP" ? inputCurrency : outputCurrency})`}
              value={minimumAmount}
              onChange={(event) => setMinimumAmount(event.target.value)}
              inputMode="decimal"
            />
          </div>
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />
      ) : null}

      {mode === "ngn" ? (
      <ReasonModal
        open
        title="NGN Quidax markup"
        description="Worsens customer-facing Quidax rates. No Bakkt sync."
        confirmLabel="Save markup"
        busy={busy}
        error={error}
        extraFields={(
          <TextField label="Markup %" value={ngnPercent} onChange={(event) => setNgnPercent(event.target.value)} inputMode="decimal" required />
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />
      ) : null}

      {mode === "purge" ? (
      <ReasonModal
        open
        title="Clear simulator fee records"
        description="Deletes sync-job clutter and inactive LOCAL_ONLY rules."
        confirmLabel="Clear"
        busy={busy}
        error={error}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />
      ) : null}

      {mode === "fx" ? (
      <ReasonModal
        open
        title="Publish FX rate"
        description="Manual FX observation for the rate board."
        confirmLabel="Save rate"
        busy={busy}
        error={error}
        extraFields={(
          <div className="ops-stack">
            <FieldSelect label="Base" value={baseCurrency} onChange={setBaseCurrency}><CurrencyOptions /></FieldSelect>
            <FieldSelect label="Quote" value={quoteCurrency} onChange={setQuoteCurrency}><CurrencyOptions /></FieldSelect>
            <TextField label="Rate" value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" required />
            <TextField label="Source" value={source} onChange={(event) => setSource(event.target.value)} />
            <TextField label="Evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
          </div>
        )}
        onClose={() => { if (!busy) setMode(null); }}
        onConfirm={confirm}
      />
      ) : null}
    </div>
  );
}

export function FeeDisableButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="small"
      variant="quiet"
      disabled={busy}
      onClick={() => {
        void (async () => {
          const reason = await promptReason({
            title: "Disable fee",
            text: `Disable ${label} and sync to Bakkt now.`,
            confirmLabel: "Disable",
          });
          if (!reason) return;
          setBusy(true);
          const response = await adminFetch(`/api/admin/fees/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          });
          setBusy(false);
          if (!response.ok && response.status !== 204) {
            const data = await response.json().catch(() => null) as { title?: string; detail?: string } | null;
            await confirmAction({
              title: "Disable failed",
              text: data?.detail ?? data?.title ?? "Could not disable fee.",
              confirmLabel: "OK",
              tone: "danger",
              showCancelButton: false,
            });
            return;
          }
          const saved = response.status === 204 ? null : await response.json().catch(() => null) as { syncStatus?: string } | null;
          const sync = (saved?.syncStatus || "").toUpperCase();
          await notifySuccess(
            sync === "SYNCED" ? "Disabled on Bakkt" : "Fee disabled",
            sync === "SYNCED" ? "Bakkt was updated immediately." : sync ? `Status: ${sync}` : undefined,
          );
          router.refresh();
        })();
      }}
    >
      Disable
    </Button>
  );
}

export function FeeRetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="small"
      variant="quiet"
      disabled={busy}
      onClick={() => {
        void (async () => {
          const reason = await promptReason({
            title: "Retry Bakkt sync",
            text: "Re-queue this fee synchronization job.",
            confirmLabel: "Retry",
          });
          if (!reason) return;
          setBusy(true);
          await adminFetch(`/api/admin/fees/synchronizations/${id}/retry`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          });
          setBusy(false);
          router.refresh();
        })();
      }}
    >
      Retry
    </Button>
  );
}
