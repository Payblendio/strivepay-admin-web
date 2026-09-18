function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function publicRequestOrigin(headers: Headers, fallbackOrigin: string) {
  const fallback = new URL(fallbackOrigin);
  const host = firstHeaderValue(headers.get("x-forwarded-host"))
    ?? firstHeaderValue(headers.get("host"));
  const protocol = firstHeaderValue(headers.get("x-forwarded-proto"))
    ?? fallback.protocol.replace(":", "");

  if (!host) return fallback.origin;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return fallback.origin;
  }
}

export function hasValidRequestOrigin(origin: string | null, headers: Headers, fallbackOrigin: string) {
  if (!origin) return true;

  try {
    return new URL(origin).origin === publicRequestOrigin(headers, fallbackOrigin);
  } catch {
    return false;
  }
}
