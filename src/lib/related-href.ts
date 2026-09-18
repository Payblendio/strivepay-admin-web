/** Resolve admin deep-links for treasury/alert related entities. */
export function relatedHref(type: string, relatedId: string) {
  if (!relatedId || relatedId === "—") return null;
  const kind = (type || "").toUpperCase();
  if (kind === "TREASURY_TASK") return `/treasury/tasks/${relatedId}`;
  if (kind === "ORDER" || kind === "TRANSACTION" || kind === "RAMP" || kind === "BAKKT_TRANSACTION") {
    return `/transactions/${relatedId}`;
  }
  if (kind === "PARTY" || kind === "CUSTOMER") return `/customers/${relatedId}`;
  if (kind === "FEE_RULE") return `/fees/${relatedId}`;
  if (kind === "AUTOMATIC_CONVERSION" || kind.includes("CONVERSION")) return "/treasury";
  return null;
}
