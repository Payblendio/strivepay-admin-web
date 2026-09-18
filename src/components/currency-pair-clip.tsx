"use client";

import { currencyLogo, isFiatAsset } from "./currency-logos";

const PIXELS = { sm: 24, md: 30, lg: 36 } as const;

function Disc({ code, pixels }: { code: string; pixels: number }) {
  const value = (code || "").trim().toUpperCase() || "—";
  return (
    <span className="ops-currency-clip-disc" data-kind={isFiatAsset(value) ? "fiat" : "crypto"}>
      {currencyLogo(value, pixels)}
    </span>
  );
}

/** Overlapping source→destination currency marks per transaction. */
export function CurrencyPairClip({
  from,
  to,
  size = "sm",
}: {
  from: string | null | undefined;
  to: string | null | undefined;
  size?: keyof typeof PIXELS;
}) {
  const pixels = PIXELS[size];
  return (
    <span className="ops-currency-clip" data-size={size} aria-hidden="true">
      <Disc code={from || ""} pixels={pixels} />
      <Disc code={to || ""} pixels={pixels} />
    </span>
  );
}

/** Flag (or token mark) leading a currency code. */
export function CurrencyCodeMark({
  code,
  size = "sm",
}: {
  code: string | null | undefined;
  size?: keyof typeof PIXELS;
}) {
  const value = (code || "").trim().toUpperCase();
  if (!value || value === "—") return "—";
  const pixels = size === "sm" ? 18 : size === "md" ? 22 : 26;
  return (
    <span className="ops-currency-code">
      <span className="ops-currency-code-flag" aria-hidden="true">
        {currencyLogo(value, pixels)}
      </span>
      <span>{value}</span>
    </span>
  );
}
