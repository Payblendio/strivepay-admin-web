export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function asString(value: unknown, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function field(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] != null) return row[key];
    const lower = key.toLowerCase();
    for (const [candidate, value] of Object.entries(row)) {
      if (candidate.toLowerCase() === lower || candidate.replaceAll("_", "").toLowerCase() === key.replaceAll("_", "").toLowerCase()) {
        return value;
      }
    }
  }
  return undefined;
}

export function text(row: Record<string, unknown>, ...keys: string[]) {
  return asString(field(row, ...keys), "—");
}

export function formatInstant(value: unknown) {
  if (value == null || value === "") return "—";
  const date = value instanceof Date
    ? value
    : typeof value === "number"
      ? new Date(value > 1e12 ? value : value * 1000)
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) return asString(value);
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function formatAmount(value: unknown, asset?: unknown) {
  const amount = asString(value, "—");
  const code = asString(asset);
  return code ? `${amount} ${code}` : amount;
}

/** Formats fee rates stored as 0–1 fractions (0.02 → 2%). */
export function formatPercentRate(value: unknown) {
  const rate = asNumber(value);
  if (rate == null) return "—";
  const pct = rate <= 1 ? rate * 100 : rate;
  const rounded = Math.round(pct * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)}%`;
}

export function assetOrAny(value: unknown) {
  const code = asString(value).trim();
  return code && code !== "—" ? code : "Any";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SP";
  return `${parts[0][0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function formatTransactionDirection(value: unknown) {
  const direction = asString(value).toUpperCase();
  switch (direction) {
    case "NGN_TO_CRYPTO":
    case "FIAT_TO_CRYPTO":
    case "BUY":
    case "ONRAMP":
      return "Buy crypto";
    case "CRYPTO_TO_NGN":
    case "CRYPTO_TO_FIAT":
    case "SELL":
    case "OFFRAMP":
      return "Sell crypto";
    case "—":
    case "":
      return "—";
    default:
      return direction.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function transactionHeading(row: Record<string, unknown>) {
  const source = text(row, "source_asset", "sourceAsset");
  const destination = text(row, "destination_asset", "destinationAsset");
  const provider = text(row, "provider");
  const type = formatTransactionDirection(text(row, "transaction_type", "transactionType", "direction"));
  if (source !== "—" && destination !== "—") {
    return `${source} → ${destination}`;
  }
  if (type !== "—") return provider !== "—" ? `${provider} · ${type}` : type;
  return provider !== "—" ? provider : "Transaction";
}

export function toneForStatus(status: string) {
  const value = status.toUpperCase();
  if (["READY", "ACTIVE", "COMPLETE", "COMPLETED", "SETTLED", "SUCCESS", "SUCCEEDED", "PROCESSED", "PROCESS_COMPLETED", "EARNED", "PASSED", "OUTSIDE_TRANSFER_RECEIVED", "OUTSIDE_TRANSFER_APPROVED"].includes(value)) return "success" as const;
  if (["PENDING", "PROCESSING", "EXECUTING", "FUNDING", "REVIEW", "COMPLIANCE_REVIEW", "REFUNDED", "ON_HOLD"].includes(value) || value.includes("PENDING")) return "warning" as const;
  if (["FAILED", "DISABLED", "DEAD", "NOT_READY", "CRITICAL", "ERROR"].includes(value) || value.includes("FAIL")) return "danger" as const;
  return "neutral" as const;
}
