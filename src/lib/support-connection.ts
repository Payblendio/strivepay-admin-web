export type SupportConnectionState = "connecting" | "connected" | "reconnecting" | "offline" | "expired";
export type SupportConnectionTicket = {connectionToken: string; websocketUrl: string};
export type SupportConnectionOptions = {
  requestTicket: (signal: AbortSignal) => Promise<SupportConnectionTicket | null>;
  onChange: () => void;
  onTransactionChange?: () => void;
  onState: (state: SupportConnectionState) => void;
  activity?: () => {ticketId: string | null; typing: boolean};
  onTyping?: (state: {ticketId: string; customer: boolean; agent: boolean}) => void;
};

/** One account-scoped connection. Dispose it whenever the workspace or signed-in identity changes. */
export function connectSupport(options: SupportConnectionOptions): () => void {
  let disposed = false, attempts = 0, socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let presenceTimer: ReturnType<typeof setInterval> | undefined;
  let handshake: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;
  let generation = 0;
  const clearSocket = () => {
    clearInterval(watchdog); clearInterval(presenceTimer); clearTimeout(handshake);
    if (socket) { socket.onclose = null; socket.onmessage = null; socket.onerror = null; socket.close(); socket = undefined; }
  };
  const schedule = () => {
    if (disposed) return;
    clearTimeout(retry);
    options.onState(navigator.onLine ? "reconnecting" : "offline");
    if (!navigator.onLine) return;
    retry = setTimeout(() => void open(), Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) + Math.random() * 500);
  };
  const open = async () => {
    if (disposed) return;
    clearTimeout(retry); clearSocket(); pending?.abort();
    if (!navigator.onLine) { options.onState("offline"); return; }
    const current = ++generation;
    const controller = new AbortController(); pending = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    options.onState(attempts ? "reconnecting" : "connecting");
    try {
      const ticket = await options.requestTicket(controller.signal);
      if (disposed || current !== generation) return;
      if (!ticket) { options.onState("expired"); return; }
      socket = new WebSocket(ticket.websocketUrl, ["strivepay-support", "ticket." + ticket.connectionToken]);
      const active = socket;
      let lastSeen = Date.now();
      handshake = setTimeout(() => active.close(), 10000);
      active.onmessage = event => {
        if (disposed || active !== socket) return;
        let message: {type?: string;ticketId?:string;customer?:boolean;agent?:boolean};
        try { message = JSON.parse(event.data); } catch { return; }
        lastSeen = Date.now();
        if (message.type === "ready") {
          clearTimeout(handshake); attempts = 0; options.onState("connected"); options.onChange();
          clearInterval(watchdog);
          let watched: string | null | undefined;
          let wasTyping = false;
          const updatePresence = () => {
            if (!options.activity || active.readyState !== WebSocket.OPEN) return;
            const state = options.activity();
            if (state.ticketId !== watched) {
              active.send(JSON.stringify({type:"watch",ticketId:state.ticketId}));
              watched = state.ticketId; wasTyping = false;
            }
            if (watched && (state.typing || wasTyping)) active.send(JSON.stringify({type:"typing",active:state.typing}));
            wasTyping = state.typing;
          };
          clearInterval(presenceTimer); updatePresence();
          presenceTimer = setInterval(updatePresence, 2000);
          watchdog = setInterval(() => {
            if (Date.now() - lastSeen > 45000) { active.close(); return; }
            if (active.readyState === WebSocket.OPEN) active.send("ping");
          }, 20000);
        } else if (message.type === "support.changed") options.onChange();
        else if (message.type === "transaction.changed") options.onTransactionChange?.();
        else if (message.type === "typing" && typeof message.ticketId === "string") options.onTyping?.({ticketId:message.ticketId,customer:message.customer===true,agent:message.agent===true});
      };
      active.onerror = () => active.close();
      active.onclose = () => { if (active !== socket || disposed) return; clearSocket(); schedule(); };
    } catch { if (!disposed && current === generation) schedule(); }
    finally { clearTimeout(timeout); }
  };
  const online = () => { if (!disposed) void open(); };
  const offline = () => { generation++; pending?.abort(); clearTimeout(retry); clearSocket(); options.onState("offline"); };
  window.addEventListener("online", online); window.addEventListener("offline", offline);
  void open();
  return () => { disposed = true; generation++; pending?.abort(); clearTimeout(retry); clearSocket(); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
}
