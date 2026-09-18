import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {connectSupport} from "./support-connection";
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  onmessage: ((event: {data: string}) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  constructor(public url: string, public protocols: string[]) { Socket.instances.push(this); }
  receive(type: string) { this.onmessage?.({data: JSON.stringify({type})}); }
}
describe("support connection lifecycle", () => {
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers(); Socket.instances = [];
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("navigator", {onLine: true});
    vi.stubGlobal("WebSocket", Socket);
  });
  afterEach(() => { dispose?.(); dispose = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("resyncs on ready and change, sends heartbeats, then disposes", async () => {
    const onChange = vi.fn(), onState = vi.fn();
    dispose = connectSupport({requestTicket: async () => ({connectionToken: "single-use", websocketUrl: "ws://localhost/socket"}), onChange, onState});
    await vi.advanceTimersByTimeAsync(0);
    const socket = Socket.instances[0];
    expect(socket.protocols).toEqual(["strivepay-support", "ticket.single-use"]);
    socket.receive("ready"); socket.receive("support.changed");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith("connected");
    await vi.advanceTimersByTimeAsync(20000);
    expect(socket.send).toHaveBeenCalledWith("ping");
    dispose(); await vi.advanceTimersByTimeAsync(60000);
    expect(Socket.instances).toHaveLength(1);
  });
  it("notifies the transaction refresh subscriber without reloading support state", async () => {
    const onChange = vi.fn(), onTransactionChange = vi.fn();
    dispose = connectSupport({requestTicket: async () => ({connectionToken: "single-use", websocketUrl: "ws://localhost/socket"}), onChange, onTransactionChange, onState: vi.fn()});
    await vi.advanceTimersByTimeAsync(0);
    const socket = Socket.instances[0]; socket.receive("ready"); socket.receive("transaction.changed");
    expect(onTransactionChange).toHaveBeenCalledTimes(1); expect(onChange).toHaveBeenCalledTimes(1);
  });
  it("gets a fresh ticket after a dropped socket", async () => {
    const requestTicket = vi.fn(async () => ({connectionToken: "fresh", websocketUrl: "ws://localhost/socket"}));
    dispose = connectSupport({requestTicket, onChange: vi.fn(), onState: vi.fn()});
    await vi.advanceTimersByTimeAsync(0);
    Socket.instances[0].receive("ready"); Socket.instances[0].close();
    await vi.advanceTimersByTimeAsync(1600);
    expect(requestTicket).toHaveBeenCalledTimes(2);
    expect(Socket.instances).toHaveLength(2);
  });
  it("watches the selected thread and stops typing when activity ends", async () => {
    const activity={ticketId:"ticket-one" as string|null,typing:true}, onTyping=vi.fn();
    dispose=connectSupport({requestTicket:async()=>({connectionToken:"fresh",websocketUrl:"ws://localhost/socket"}),onChange:vi.fn(),onState:vi.fn(),activity:()=>activity,onTyping});
    await vi.advanceTimersByTimeAsync(0);const socket=Socket.instances[0];socket.receive("ready");
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({type:"watch",ticketId:"ticket-one"}));
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({type:"typing",active:true}));
    activity.typing=false;await vi.advanceTimersByTimeAsync(2000);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({type:"typing",active:false}));
    socket.onmessage?.({data:JSON.stringify({type:"typing",ticketId:"ticket-one",agent:true,customer:false})});
    expect(onTyping).toHaveBeenCalledWith({ticketId:"ticket-one",agent:true,customer:false});
    activity.ticketId=null;await vi.advanceTimersByTimeAsync(2000);
    expect(socket.send).toHaveBeenLastCalledWith(JSON.stringify({type:"watch",ticketId:null}));
  });
  it("does not loop when authentication is expired", async () => {
    const requestTicket = vi.fn(async () => null), onState = vi.fn();
    dispose = connectSupport({requestTicket, onChange: vi.fn(), onState});
    await vi.advanceTimersByTimeAsync(60000);
    expect(onState).toHaveBeenLastCalledWith("expired");
    expect(requestTicket).toHaveBeenCalledTimes(1);
    expect(Socket.instances).toHaveLength(0);
  });
  it("does not connect when an in-flight ticket finishes after disposal", async () => {
    let resolve!: (value: {connectionToken: string; websocketUrl: string}) => void;
    dispose = connectSupport({requestTicket: () => new Promise(done => { resolve = done; }), onChange: vi.fn(), onState: vi.fn()});
    dispose();
    resolve({connectionToken: "unused", websocketUrl: "ws://localhost/socket"});
    await vi.advanceTimersByTimeAsync(0);
    expect(Socket.instances).toHaveLength(0);
  });
});
