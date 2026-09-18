export const WEBHOOK_PROVIDERS = [
  {
    value: "BAKKT",
    label: "Bakkt",
    description: "Settlement and identity callbacks",
    callbackPath: "/webhooks/settlement",
    auth: "Authorization: API-Key <secret>",
    extraHeaders: ["X-Bakkt-Timestamp"],
    secretEnv: "STRIVEPAY_BAKKT_WEBHOOK_SECRET",
    notes: "Bakkt returns the signing secret once at create or rotate. StrivePay stores it encrypted and never shows it again. Env fallbacks remain STRIVEPAY_BAKKT_WEBHOOK_SECRET and STRIVEPAY_BAKKT_PREVIOUS_WEBHOOK_SECRET.",
    events: ["KYC", "KYB", "fiatToCrypto", "cryptoToFiat", "unblockBankAccount", "linkBankAccount", "linkedBankAccountProfile", "walletCreated", "entityStatusUpdate", "AML", "duplicateUser", "senderNameMismatch", "otpNotification"],
  },
  {
    value: "QUIDAX",
    label: "Quidax",
    description: "Liquidity callbacks",
    callbackPath: "/webhooks/liquidity",
    auth: "quidax-signature",
    extraHeaders: [] as string[],
    secretEnv: "STRIVEPAY_QUIDAX_WEBHOOK_SECRET",
    notes: "Quidax HMAC signatures are verified before the inbox stores a sanitized payload. Raw secrets never appear in logs.",
    events: [] as string[],
  },
] as const;

export type WebhookProviderCode = (typeof WEBHOOK_PROVIDERS)[number]["value"];
export type WebhookView = "setup" | "logs";

export type WebhookEndpoint = {
  providerEndpointId: string;
  url: string;
  description: string;
  status: string;
  subscribedEvents: string[];
  signingSecretStored: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  providerMode: string;
};

export function webhookProvider(code: string | undefined) {
  return WEBHOOK_PROVIDERS.find((provider) => provider.value === code) ?? WEBHOOK_PROVIDERS[0];
}

export function webhookHref(provider: string, view: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ provider, view, ...extra });
  return `/webhooks?${params.toString()}`;
}
