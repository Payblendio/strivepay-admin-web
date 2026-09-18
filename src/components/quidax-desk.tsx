"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCoin, IconUsers, IconArrowsExchange, IconWallet } from "@tabler/icons-react";
import {
  OpsDetailFacts,
  OpsDetailSection,
  OpsDetailShell,
  OpsDetailSummary,
  OpsDetailTitle,
} from "@/components/ops-detail-shell";
import { ViewLink } from "@/components/view-link";
import { DataTable, TablePerson } from "@/components/ui/data-table";
import { Badge, Button, TextField } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/status-state";
import { adminFetch } from "@/lib/admin-session";
import { promptReason } from "@/lib/swal";
import { formatAmount, toneForStatus } from "@/lib/values";

export type QuidaxAccount = {
  id: string;
  sn?: string | null;
  email?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  reference?: string | null;
  parent?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type QuidaxWallet = {
  id?: string | null;
  currency: string;
  name?: string | null;
  balance?: number | string | null;
  locked?: number | string | null;
  convertedBalance?: number | string | null;
  crypto?: boolean;
  blockchainEnabled?: boolean;
  defaultNetwork?: string | null;
  networks?: string[];
  depositAddress?: string | null;
  destinationTag?: string | null;
  updatedAt?: string | null;
};

type SwapQuote = {
  quoteId?: string | null;
  fromCurrency: string;
  fromAmount?: number | string | null;
  toCurrency: string;
  toAmount?: number | string | null;
  rate?: number | string | null;
  fee?: number | string | null;
  expiresAt?: string | null;
  preview?: boolean;
};

type SwapResult = {
  quoteId?: string | null;
  swapId: string;
  fromCurrency?: string | null;
  fromAmount?: number | string | null;
  toCurrency?: string | null;
  toAmount?: number | string | null;
  rate?: number | string | null;
  fee?: number | string | null;
  status?: string | null;
};

function errorMessage(data: { title?: string; detail?: string } | null, fallback: string) {
  return data?.detail || data?.title || fallback;
}

function accountLabel(row: QuidaxAccount) {
  return row.displayName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || row.id;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await adminFetch(`/api/admin/provider/quidax${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const value = (await response.json().catch(() => null)) as
    | ({ title?: string; detail?: string } & T)
    | null;
  if (!response.ok) throw new Error(errorMessage(value, "Quidax operation failed"));
  return value as T;
}

export function QuidaxDesk({
  canManage,
  mode,
  enabled,
  parent,
  wallets,
  accounts,
  loadError,
}: {
  canManage: boolean;
  mode: string;
  enabled: boolean;
  parent: QuidaxAccount | null;
  wallets: QuidaxWallet[];
  accounts: QuidaxAccount[];
  loadError?: string;
}) {
  const router = useRouter();
  const funded = useMemo(
    () => wallets.filter((row) => Number(row.balance ?? 0) > 0),
    [wallets],
  );
  const [fromCurrency, setFromCurrency] = useState(funded[0]?.currency || "NGN");
  const [toCurrency, setToCurrency] = useState("TRX");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SwapQuote | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [result, setResult] = useState<SwapResult | null>(null);

  async function syncBalances() {
    if (!canManage) {
      router.refresh();
      return;
    }
    const reason = await promptReason({
      title: "Sync parent balances",
      text: "Pull live Quidax parent wallet balances into this desk.",
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<QuidaxWallet[]>("/parent/wallets/sync", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setMessage("Parent balances synced from Quidax.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync parent balances.");
    } finally {
      setBusy(false);
    }
  }

  const currencyOptions = useMemo(() => {
    const codes = new Set(wallets.map((row) => row.currency).filter(Boolean));
    ["NGN", "TRX", "USDT", "BTC", "ETH", "USDC"].forEach((code) => codes.add(code));
    return [...codes].sort();
  }, [wallets]);

  async function runPreview() {
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    setQuote(null);
    try {
      const value = await api<SwapQuote>("/parent/swap/preview", {
        method: "POST",
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          amount: amount.trim(),
        }),
      });
      setPreview(value);
      setMessage(`Preview ready: ${formatAmount(value.fromAmount, value.fromCurrency)} → ${formatAmount(value.toAmount, value.toCurrency)}`);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not preview swap.");
    } finally {
      setBusy(false);
    }
  }

  async function runQuote() {
    if (!canManage) return;
    const reason = await promptReason({
      title: "Create swap quote",
      text: `Create an executable Quidax quote for ${amount.trim()} ${fromCurrency} → ${toCurrency}.`,
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    try {
      const value = await api<SwapQuote>("/parent/swap/quote", {
        method: "POST",
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          amount: amount.trim(),
          reason,
        }),
      });
      setQuote(value);
      setPreview(value);
      setMessage(`Executable quote ${value.quoteId} created. Confirm to settle.`);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Could not create swap quote.");
    } finally {
      setBusy(false);
    }
  }

  async function runConfirm() {
    if (!canManage || !quote?.quoteId) return;
    const reason = await promptReason({
      title: "Confirm Quidax swap",
      text: `Confirm quote ${quote.quoteId} on the parent wallet.`,
    });
    if (!reason) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await api<SwapResult>("/parent/swap/confirm", {
        method: "POST",
        body: JSON.stringify({ quoteId: quote.quoteId, reason }),
      });
      setResult(value);
      setMessage(`Swap ${value.swapId} confirmed (${value.status ?? "SUCCEEDED"}). Refresh wallets to see balances.`);
      setQuote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm swap.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return <EmptyState title="Quidax unavailable" description={loadError} />;
  }

  return (
    <OpsDetailShell
      backHref="/treasury"
      backLabel="Back to treasury"
      defaultTab="wallets"
      navLabel="Quidax"
      headerTitle={(
        <OpsDetailTitle
          icon={<IconCoin size={22} />}
          title="Quidax liquidity"
          status={<Badge tone={enabled ? "success" : "warning"} dot>{mode}</Badge>}
          subtitle={parent ? `${accountLabel(parent)} · ${parent.email ?? parent.id}` : "Parent account"}
        />
      )}
      sidebarSummary={(
        <OpsDetailSummary
          items={[
            { label: "Mode", value: mode },
            { label: "Parent wallets", value: String(wallets.length) },
            { label: "Funded wallets", value: String(funded.length) },
            { label: "Sub-accounts", value: String(accounts.length) },
          ]}
        />
      )}
      tabs={[
        {
          id: "wallets",
          label: "Parent wallets",
          icon: <IconWallet size={16} />,
          content: (
            <OpsDetailSection title="Parent wallets" kicker="Balances">
              {parent ? (
                <OpsDetailFacts
                  items={[
                    { label: "Account id", value: parent.id },
                    { label: "SN", value: parent.sn || "—" },
                    { label: "Email", value: parent.email || "—" },
                    { label: "Display name", value: accountLabel(parent) },
                  ]}
                />
              ) : null}
              <div className="ops-toolbar" style={{ marginBottom: "1rem" }}>
                <Button variant="secondary" size="medium" disabled={busy} onClick={() => void syncBalances()}>
                  Sync balances
                </Button>
                {message ? <p className="ops-copy" aria-live="polite">{message}</p> : null}
                {error ? <p className="ops-copy" role="alert">{error}</p> : null}
              </div>
              <DataTable
                columns={[
                  {
                    key: "currency",
                    header: "Asset",
                    render: (row) => (
                      <TablePerson
                        title={row.currency}
                        subtitle={row.crypto ? "Crypto" : "Fiat"}
                        initials={row.currency.slice(0, 2)}
                      />
                    ),
                  },
                  {
                    key: "balance",
                    header: "Available",
                    render: (row) => formatAmount(row.balance, row.currency),
                  },
                  {
                    key: "locked",
                    header: "Locked",
                    render: (row) => formatAmount(row.locked, row.currency),
                  },
                  {
                    key: "network",
                    header: "Network",
                    render: (row) => row.defaultNetwork || (row.networks?.join(", ") ?? "—"),
                  },
                  {
                    key: "actions",
                    header: "",
                    render: (row) => <ViewLink href={`/quidax/wallets/${encodeURIComponent(row.currency)}`} />,
                  },
                ]}
                rows={wallets}
                getKey={(row) => row.id || row.currency}
                empty={<EmptyState compact title="No wallets returned" description="Quidax did not return parent wallets for this key." />}
              />
            </OpsDetailSection>
          ),
        },
        {
          id: "accounts",
          label: "Sub-accounts",
          icon: <IconUsers size={16} />,
          content: (
            <OpsDetailSection title="Sub-accounts" kicker="Users">
              <DataTable
                columns={[
                  {
                    key: "account",
                    header: "Account",
                    render: (row) => (
                      <TablePerson
                        title={accountLabel(row)}
                        subtitle={row.email || row.id}
                        initials={(accountLabel(row) || "QX").slice(0, 2).toUpperCase()}
                      />
                    ),
                  },
                  { key: "sn", header: "SN", render: (row) => row.sn || "—" },
                  {
                    key: "id",
                    header: "User id",
                    render: (row) => <Link className="ops-link" href={`/quidax/accounts/${row.id}`}>{row.id}</Link>,
                  },
                  {
                    key: "actions",
                    header: "",
                    render: (row) => <ViewLink href={`/quidax/accounts/${row.id}`} />,
                  },
                ]}
                rows={accounts}
                getKey={(row) => row.id}
                empty={<EmptyState compact title="No sub-accounts" description="No Quidax sub-accounts were returned for this parent." />}
              />
            </OpsDetailSection>
          ),
        },
        {
          id: "swap",
          label: "Swap",
          icon: <IconArrowsExchange size={16} />,
          content: (
            <OpsDetailSection title="Parent swap" kicker="Liquidity">
              <p className="ops-copy">
                Preview uses Quidax temporary quotations. Creating a quote opens an executable swap on the parent wallet; confirm settles it.
              </p>
              {!canManage ? (
                <p className="ops-copy">treasury.manage is required to create or confirm swaps. Preview still works with treasury.view.</p>
              ) : null}
              <div className="ops-toolbar" style={{ alignItems: "end" }}>
                <label className="sp-field">
                  <span>From</span>
                  <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
                    {currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
                <label className="sp-field">
                  <span>To</span>
                  <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}>
                    {currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </label>
                <TextField
                  label="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  inputMode="decimal"
                />
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
                    { label: "Fee", value: preview.fee != null ? String(preview.fee) : "—" },
                    { label: "Expires", value: preview.expiresAt || "—" },
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
              {result ? (
                <OpsDetailFacts
                  items={[
                    { label: "Swap id", value: result.swapId },
                    { label: "Status", value: <Badge tone={toneForStatus(result.status || "SUCCEEDED")} dot>{result.status || "SUCCEEDED"}</Badge> },
                    { label: "From", value: formatAmount(result.fromAmount, result.fromCurrency) },
                    { label: "To", value: formatAmount(result.toAmount, result.toCurrency) },
                  ]}
                />
              ) : null}
            </OpsDetailSection>
          ),
        },
      ]}
    />
  );
}
