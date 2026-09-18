import { asRecord, asString } from "@/lib/values";

export function asList(payload: unknown) {
  return (Array.isArray(payload) ? payload : []).map(asRecord);
}

export async function loadList(response: Response) {
  const payload = await responseBodySafe(response);
  if (!response.ok) {
    return {
      ok: false as const,
      rows: [] as ReturnType<typeof asList>,
      error: asString(asRecord(payload).title, "This section could not be loaded."),
    };
  }
  return { ok: true as const, rows: asList(payload), error: "" };
}

export async function loadPage(response: Response, fallback: { page: number; size: number }) {
  const payload = await responseBodySafe(response);
  if (!response.ok) {
    return {
      ok: false as const,
      data: { page: fallback.page, size: fallback.size, total: 0, items: [] as unknown[] },
      rows: [] as ReturnType<typeof asList>,
      error: asString(asRecord(payload).title, "This section could not be loaded."),
    };
  }
  const data = (payload ?? { page: fallback.page, size: fallback.size, total: 0, items: [] }) as {
    page?: number;
    size?: number;
    total?: number;
    items?: unknown[];
  };
  const rows = (data.items ?? []).map(asRecord);
  return { ok: true as const, data, rows, error: "" };
}

async function responseBodySafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { title: "The service returned an unreadable response" };
  }
}
