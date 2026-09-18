"use client";

import Image from "next/image";
import { CircleFlag } from "react-circle-flags";

const ROUTE_TOKENS = new Set(["USDC", "USDC_E", "USDT", "CEUR", "CUSD", "AGEUR", "EURC"]);
const TOKEN_IMAGE: Record<string, string> = {
  USDC: "USDC",
  USDC_E: "USDCE",
  USDT: "USDT",
  CEUR: "CEUR",
  CUSD: "CUSD",
  AGEUR: "AGEUR",
  EURC: "EURC",
};
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

export function assetLogo(code: string, size = 32) {
  const value = code.trim().toUpperCase();
  if (ROUTE_TOKENS.has(value)) {
    return (
      <Image
        src={`/branding/tokens/${TOKEN_IMAGE[value] ?? value}.png`}
        alt={value.replace("_", ".")}
        width={size}
        height={size}
      />
    );
  }
  return (
    <Image
      src={`/branding/crypto/${value.toLowerCase()}.svg`}
      alt={value}
      width={size}
      height={size}
    />
  );
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
