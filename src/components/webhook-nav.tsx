"use client";

import { useRouter } from "next/navigation";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { webhookHref, WEBHOOK_PROVIDERS, type WebhookView } from "@/lib/webhooks";

const VIEWS = [
  { value: "setup", label: "Webhook setup", description: "Callback URL, headers, and secret location" },
  { value: "logs", label: "Logs", description: "Inbox events, retries, and failures" },
];

export function WebhookNav({ provider, view }: { provider: string; view: WebhookView }) {
  const router = useRouter();

  return (
    <div className="ops-toolbar">
      <ChoiceSelect
        label="Provider"
        value={provider}
        title="Choose a provider"
        description="Webhook setup and logs are scoped to one provider at a time."
        options={WEBHOOK_PROVIDERS.map((item) => ({
          value: item.value,
          label: item.label,
          description: item.description,
          leading: <span className="ops-provider-mark">{item.label[0]}</span>,
        }))}
        onChange={(value) => router.push(webhookHref(value, view))}
      />
      <ChoiceSelect
        label="Section"
        value={view}
        title={`${provider} webhooks`}
        description="Open setup details or the inbound event log."
        options={VIEWS}
        onChange={(value) => router.push(webhookHref(provider, value))}
      />
    </div>
  );
}
