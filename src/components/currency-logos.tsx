"use client";

import { CircleFlag } from "react-circle-flags";
import { useAssetCatalog } from "@/lib/asset-catalog";

export const FIAT_FLAG: Record<string, string> = {
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  NGN: "ng",
  AED: "ae",
  TRY: "tr",
  INR: "in",
  PKR: "pk",
  BRL: "br",
  ARS: "ar",
  CAD: "ca",
  COP: "co",
  IDR: "id",
  KES: "ke",
  PHP: "ph",
  VND: "vn",
  GHS: "gh",
  GTQ: "gt",
  MXN: "mx",
  JPY: "jp",
  NPR: "np",
  OMR: "om",
  QAR: "qa",
  SGD: "sg",
  TZS: "tz",
  UGX: "ug",
  XAF: "cm",
  ZMW: "zm",
};

export function isFiatAsset(code: string) {
  return Boolean(FIAT_FLAG[code]);
}

/** Round logo from the asset catalog's CoinGecko URL; falls back to the ticker's initials. */
export function AssetLogo({ code, size = 32, url }: { code: string; size?: number; url?: string | null }) {
  const value = code.trim().toUpperCase();
  const catalog = useAssetCatalog();
  const src = url ?? catalog.find((asset) => asset.code === value)?.logoUrl;
  if (!src) {
    return (
      <span className="ops-asset-logo fallback" style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }} aria-label={value}>
        {value.replace("_", "").slice(0, 3)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- admins may point logos at any https host
  return <img className="ops-asset-logo" src={src} alt={value.replace("_", ".")} width={size} height={size} loading="lazy" />;
}

export function assetLogo(code: string, size = 32) {
  return <AssetLogo code={code} size={size} />;
}

export function fiatLogo(code: string, size = 34) {
  return (
    <span className="ops-currency-logo fiat" suppressHydrationWarning>
      <CircleFlag countryCode={FIAT_FLAG[code] ?? "un"} height={String(size)} />
    </span>
  );
}

export function currencyLogo(code: string, size = 24) {
  const value = (code || "").trim().toUpperCase();
  if (!value) return null;
  return isFiatAsset(value)
    ? fiatLogo(value, size)
    : <span className="ops-currency-logo">{assetLogo(value, size)}</span>;
}
