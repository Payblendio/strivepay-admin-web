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

function configuredPublicOrigins() {
  const origins = new Set<string>();
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.ADMIN_API_URL]) {
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // ignore invalid env
    }
  }
  return origins;
}

export function hasValidRequestOrigin(origin: string | null, headers: Headers, fallbackOrigin: string) {
  if (!origin) return true;

  try {
    const requestOrigin = new URL(origin).origin;
    const publicOrigin = publicRequestOrigin(headers, fallbackOrigin);
    if (requestOrigin === publicOrigin) return true;

    const request = new URL(origin);
    const published = new URL(publicOrigin);
    if (request.host === published.host && request.protocol === "https:" && published.protocol === "http:") {
      return true;
    }

    return configuredPublicOrigins().has(requestOrigin);
  } catch {
    return false;
  }
}
