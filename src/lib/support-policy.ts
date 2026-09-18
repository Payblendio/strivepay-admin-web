const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function supportRouteAllowed(route: string, method: string, admin = false) {
  if (new RegExp(`^tickets/${UUID}/events$`).test(route)) return admin && method === "GET";
  if (new RegExp(`^tickets/${UUID}/activity$`).test(route)) return method === "GET";
  if (route === "unread") return method === "GET";
  if (new RegExp(`^tickets/${UUID}/context$`).test(route)) return admin && method === "GET";
  if (new RegExp(`^tickets/${UUID}/attachments(?:/${UUID})?$`).test(route)) return method === "GET";
  if (new RegExp(`^tickets/${UUID}/messages/${UUID}/attachments/${UUID}$`).test(route)) return method === "POST";
  if (new RegExp(`^tickets/${UUID}/feedback$`).test(route)) return method === "GET" || (!admin && method === "POST");
  if (route === "agents") return admin && method === "GET";
  if (new RegExp(`^tickets/${UUID}/history$`).test(route)) return method === "GET";
  if (route === "tickets") return method === "GET" || (!admin && method === "POST");
  if (route === "socket-ticket") return method === "POST";
  if (new RegExp(`^tickets/${UUID}$`).test(route)) return method === "GET";
  if (new RegExp(`^tickets/${UUID}/messages$`).test(route)) return method === "GET" || method === "POST";
  if (new RegExp(`^tickets/${UUID}/(status|read)$`).test(route)) return method === "POST";
  return admin && new RegExp(`^tickets/${UUID}/assignment$`).test(route) && method === "POST";
}
export function supportSocketUrl(origin: string, configured?: string) {
  const page = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname);
  if (!configured && !local) throw new Error("Support WebSocket URL is not configured");
  const url = new URL(configured || `ws://${page.hostname}:18080/v1/support/socket`);
  if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || url.pathname !== "/v1/support/socket" || (page.protocol === "https:" && url.protocol !== "wss:")
    || (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol !== "wss:")) {
    throw new Error("Support WebSocket URL must be a secure socket endpoint");
  }
  return url.href;
}
