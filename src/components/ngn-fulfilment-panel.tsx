"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OpsDetailFacts, OpsDetailSection } from "@/components/ops-detail-shell";
import { Badge, Button, TextField } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";
import { formatAmount } from "@/lib/values";

type SwapQuote = {
  quoteId?: string | null;
  fromCurrency: string;
  fromAmount?: number | string | null;
  toCurrency: string;
  toAmount?: number | string | null;
  rate?: number | string | null;
  fee?: number | string | null;
  preview?: boolean;
};

async function swapApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await adminFetch(`/api/admin/provider/quidax${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = (await response.json().catch(() => null)) as ({ title?: string; detail?: string } & T) | null;
  if (!response.ok) throw new Error(value?.detail || value?.title || "Quidax swap failed");
  return value as T;
}

export function NgnFulfilmentPanel({
  conversionId,
  canManage,
  canResume,
  canSwap,
  canReopen,
  failureCode,
  destinationAsset,
  shortfallAmount,
  requiredAmount,
  nextSteps,
  treasuryTaskId,
}: {
  conversionId: string;
  canManage: boolean;
  canResume: boolean;
  canSwap: boolean;
  canReopen?: boolean;
  failureCode?: string | null;
  destinationAsset: string;
  shortfallAmount?: number | string | null;
  requiredAmount?: number | string | null;
  nextSteps: string[];
  treasuryTaskId?: string | null;
}) {
  const router = useRouter();
  const exactNeeded = useMemo(() => {
    const shortfall = Number(shortfallAmount ?? 0);
    const required = Number(requiredAmount ?? 0);
    const base = shortfall > 0 ? shortfall : required;
    if (!Number.isFinite(base) || base <= 0) return "";
    return base.toString();
  }, [shortfallAmount, requiredAmount]);

  const [fromCurrency, setFromCurrency] = useState("NGN");
  const [toCurrency, setToCurrency] = useState(destinationAsset || "TRX");
  const [amountMode, setAmountMode] = useState<"TO" | "FROM">("TO");
  const [amount, setAmount] = useState(exactNeeded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SwapQuote | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);

  const currencies = ["NGN", "USDT", "USDC", "BTC", "ETH", "TRX", destinationAsset].filter(Boolean);
  const uniqueCurrencies = [...new Set(currencies)];
  const shortfallLabel = shortfallAmount != null
    ? formatAmount(shortfallAmount, destinationAsset)
    : requiredAmount != null
      ? formatAmount(requiredAmount, destinationAsset)
      : destinationAsset;
  const amountHint = amountMode === "TO"
    ? exactNeeded || `Exact ${toCurrency} needed`
    : `Enter ${fromCurrency} spend amount`;

  async function resume() {
    if (!canManage || !canResume) return;
    const reason = await promptReason({
      title: "Resume liquidity",
      text: "Check parent inventory and continue delivery if the quoted crypto is covered.",
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`/api/admin/transactions/${conversionId}/resume-liquidity`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const value = await response.json().catch(() => null) as { title?: string; detail?: string; status?: string } | null;
      if (!response.ok) throw new Error(value?.detail || value?.title || "Could not resume liquidity");
      setMessage(`Status is now ${value?.status ?? "updated"}. Worker will continue delivery automatically.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume liquidity.");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!canManage || !canReopen) return;
    const reason = await promptReason({
      title: "Retry processing",
      text: "Reopen this conversion from review, clear the stuck Quidax withdrawal claim if needed, and let the worker submit delivery again.",
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await adminFetch(`/api/admin/transactions/${conversionId}/reopen-review`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const value = await response.json().catch(() => null) as { title?: string; detail?: string; status?: string } | null;
      if (!response.ok) throw new Error(value?.detail || value?.title || "Could not reopen conversion");
      setMessage(`Reopened — status is now ${value?.status ?? "updated"}. Worker will continue automatically.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen conversion.");
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    setBusy(true);
    setError("");
    setMessage("");
    setQuote(null);
    try {
      const value = await swapApi<SwapQuote>("/parent/swap/preview", {
        fromCurrency,
        toCurrency,
        amount: amount.trim(),
        amountMode,
      });
      setPreview(value);
      setMessage(`Preview: ${formatAmount(value.fromAmount, value.fromCurrency)} → ${formatAmount(value.toAmount, value.toCurrency)}`);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runQuote() {
    if (!canManage) return;
    const reason = await promptReason({
      title: "Create parent swap quote",
      text: amountMode === "TO"
        ? `Create quote to receive exactly ${amount.trim()} ${toCurrency} from ${fromCurrency} for this conversion.`
        : `Create executable quote ${amount.trim()} ${fromCurrency} → ${toCurrency} to cover this conversion.`,
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await swapApi<SwapQuote>("/parent/swap/quote", {
        fromCurrency,
        toCurrency,
        amount: amount.trim(),
        amountMode,
        reason,
      });
      setQuote(value);
      setPreview(value);
      setMessage(`Quote ${value.quoteId} ready — confirm to settle on the parent wallet.`);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Could not create quote");
    } finally {
      setBusy(false);
    }
  }

  async function runConfirm() {
    if (!canManage || !quote?.quoteId) return;
    const reason = await promptReason({
      title: "Confirm parent swap",
      text: `Confirm quote ${quote.quoteId}. Waiting conversions resume automatically when ${toCurrency} inventory covers delivery.`,
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await swapApi<{ swapId: string; resumedConversions?: number }>("/parent/swap/confirm", {
        quoteId: quote.quoteId,
        reason,
      });
      setQuote(null);
      setMessage(`Swap ${value.swapId} confirmed. Resumed ${value.resumedConversions ?? 0} conversion(s).`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm swap");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsDetailSection title="Fulfilment" kicker="What to do">
      {failureCode ? (
        <p className="ops-copy" style={{ marginBottom: "0.75rem" }}>
          Failure code: <Badge tone="warning">{failureCode}</Badge>
        </p>
      ) : null}
      {nextSteps.length ? (
        <ol className="ops-copy" style={{ margin: "0 0 1rem", paddingLeft: "1.25rem" }}>
          {nextSteps.map((step) => <li key={step} style={{ marginBottom: "0.35rem" }}>{step}</li>)}
        </ol>
      ) : (
        <p className="ops-copy">No operator action is required right now.</p>
      )}

      <div className="ops-toolbar" style={{ marginBottom: "1rem" }}>
        {canReopen ? (
          <Button variant="primary" size="medium" disabled={!canManage || busy} onClick={() => void reopen()}>
            Retry processing
          </Button>
        ) : null}
        {canResume ? (
          <Button variant="primary" size="medium" disabled={!canManage || busy} onClick={() => void resume()}>
            Resume liquidity
          </Button>
        ) : null}
        <Link className="ops-link" href="/quidax">Open Quidax desk</Link>
        {treasuryTaskId ? (
          <Link className="ops-link" href={`/treasury/tasks/${treasuryTaskId}`}>Treasury task</Link>
        ) : null}
      </div>

      {canSwap ? (
        <>
          <p className="ops-copy">
            Swap parent balance into <strong>{destinationAsset}</strong> to cover{" "}
            {shortfallLabel}. Use <Badge tone="info">Exact {destinationAsset}</Badge> so Quidax targets the shortfall amount directly.
          </p>
          {!canManage ? (
            <p className="ops-copy">treasury.manage or transactions.manage is required to swap or resume.</p>
          ) : null}
          <div className="ops-toolbar" style={{ alignItems: "end" }}>
            <label className="sp-field">
              <span>From</span>
              <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
                {uniqueCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <label className="sp-field">
              <span>To</span>
              <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}>
                {uniqueCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <label className="sp-field">
              <span>Amount mode</span>
              <select
                value={amountMode}
                onChange={(e) => {
                  const next = e.target.value === "FROM" ? "FROM" : "TO";
                  setAmountMode(next);
                  if (next === "TO" && exactNeeded) setAmount(exactNeeded);
                }}
              >
                <option value="TO">Exact {toCurrency} needed</option>
                <option value="FROM">Spend {fromCurrency}</option>
              </select>
            </label>
            <TextField
              label={amountMode === "TO" ? `${toCurrency} to receive` : `${fromCurrency} to spend`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={amountHint}
              inputMode="decimal"
            />
            {amountMode === "TO" && exactNeeded && amount !== exactNeeded ? (
              <Button variant="secondary" size="medium" disabled={busy} onClick={() => setAmount(exactNeeded)}>
                Use exact shortfall
              </Button>
            ) : null}
            <Button variant="secondary" size="medium" disabled={busy || !amount.trim()} onClick={() => void runPreview()}>
              Preview
            </Button>
            {canManage ? (
              <Button variant="primary" size="medium" disabled={busy || !amount.trim() || fromCurrency === toCurrency} onClick={() => void runQuote()}>
                Create quote
              </Button>
            ) : null}
          </div>
          {error ? <p className="ops-copy" role="alert">{error}</p> : null}
          {message ? <p className="ops-copy" aria-live="polite">{message}</p> : null}
          {preview ? (
            <OpsDetailFacts
              items={[
                { label: "Quote id", value: preview.quoteId || (preview.preview ? "preview only" : "—") },
                { label: "From", value: formatAmount(preview.fromAmount, preview.fromCurrency) },
                { label: "To", value: formatAmount(preview.toAmount, preview.toCurrency) },
                { label: "Rate", value: preview.rate != null ? String(preview.rate) : "—" },
              ]}
            />
          ) : null}
          {quote?.quoteId && canManage ? (
            <div className="ops-toolbar">
              <Button variant="primary" size="medium" disabled={busy} onClick={() => void runConfirm()}>
                Confirm quote {quote.quoteId}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {error && !canSwap ? <p className="ops-copy" role="alert">{error}</p> : null}
      {message && !canSwap ? <p className="ops-copy" aria-live="polite">{message}</p> : null}
    </OpsDetailSection>
  );
}
