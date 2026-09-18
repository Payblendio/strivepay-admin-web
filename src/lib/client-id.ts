/** UUID v4 for HTTPS and local-network HTTP browsers. Never use Math.random for request IDs. */

function uuidFromRandomValues(source: Crypto): string {
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Phone LAN HTTP often lacks crypto.randomUUID; patch it when getRandomValues exists. */
export function ensureClientRandomUUID(): void {
  const source = globalThis.crypto;
  if (!source || typeof source.randomUUID === "function" || typeof source.getRandomValues !== "function") return;
  const randomUUID = function randomUUID(this: Crypto | void): `${string}-${string}-${string}-${string}-${string}` {
    return uuidFromRandomValues(source) as `${string}-${string}-${string}-${string}-${string}`;
  };
  try {
    Object.defineProperty(source, "randomUUID", {value: randomUUID, configurable: true});
  } catch {
    try {
      (source as Crypto & {randomUUID: () => string}).randomUUID = randomUUID;
    } catch {
      /* read-only crypto; createClientId still has a manual fallback */
    }
  }
}

export function createClientId(): string {
  ensureClientRandomUUID();
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === "function") {
    try {
      return source.randomUUID();
    } catch {
      /* insecure-context stubs can exist and still throw */
    }
  }
  if (typeof source?.getRandomValues !== "function") {
    throw new Error("Secure randomness is unavailable. Use a supported browser.");
  }
  return uuidFromRandomValues(source);
}
