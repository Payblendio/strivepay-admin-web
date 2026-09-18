import { describe, expect, it } from "vitest";
import { relatedHref } from "./related-href";

/** Mirrors AdminOperationsService Bakkt source/destination orientation. */
function bakktRoute(direction: string, fiat: string, fiatAmount: number, crypto: string, cryptoAmount: number) {
  if (direction === "CRYPTO_TO_FIAT") {
    return { sourceAsset: crypto, sourceAmount: cryptoAmount, destinationAsset: fiat, destinationAmount: fiatAmount };
  }
  return { sourceAsset: fiat, sourceAmount: fiatAmount, destinationAsset: crypto, destinationAmount: cryptoAmount };
}

describe("bakkt route orientation", () => {
  it("keeps fiat→crypto for FIAT_TO_CRYPTO", () => {
    expect(bakktRoute("FIAT_TO_CRYPTO", "EUR", 125, "USDT", 141.54)).toEqual({
      sourceAsset: "EUR",
      sourceAmount: 125,
      destinationAsset: "USDT",
      destinationAmount: 141.54,
    });
  });

  it("flips to crypto→fiat for CRYPTO_TO_FIAT", () => {
    expect(bakktRoute("CRYPTO_TO_FIAT", "EUR", 62.51, "USDT", 75)).toEqual({
      sourceAsset: "USDT",
      sourceAmount: 75,
      destinationAsset: "EUR",
      destinationAmount: 62.51,
    });
  });
});

describe("relatedHref", () => {
  it("maps known related types", () => {
    expect(relatedHref("TREASURY_TASK", "abc")).toBe("/treasury/tasks/abc");
    expect(relatedHref("TRANSACTION", "abc")).toBe("/transactions/abc");
    expect(relatedHref("PARTY", "abc")).toBe("/customers/abc");
    expect(relatedHref("AUTOMATIC_CONVERSION", "abc")).toBe("/treasury");
  });

  it("returns null for unknown or empty ids", () => {
    expect(relatedHref("UNKNOWN", "abc")).toBeNull();
    expect(relatedHref("PARTY", "—")).toBeNull();
  });
});
