import { describe, expect, it } from "vitest";
import { webhookHref, webhookProvider, WEBHOOK_PROVIDERS } from "./webhooks";

describe("webhook navigation", () => {
  it("lists Bakkt first and uses it as the default provider", () => {
    expect(WEBHOOK_PROVIDERS[0].value).toBe("BAKKT");
    expect(webhookProvider(undefined).value).toBe("BAKKT");
    expect(webhookProvider("QUIDAX").label).toBe("Quidax");
  });

  it("keeps provider and section in the query string", () => {
    expect(webhookHref("BAKKT", "setup")).toBe("/webhooks?provider=BAKKT&view=setup");
    expect(webhookHref("BAKKT", "logs", { status: "FAILED" }))
      .toBe("/webhooks?provider=BAKKT&view=logs&status=FAILED");
  });

  it("exposes Bakkt merchant event types for endpoint registration", () => {
    expect(webhookProvider("BAKKT").events).toContain("fiatToCrypto");
    expect(webhookProvider("BAKKT").events).toContain("KYC");
    expect(webhookProvider("QUIDAX").events).toEqual([]);
  });
});
