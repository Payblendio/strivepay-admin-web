import {afterEach,describe,expect,it,vi} from "vitest";
import {createClientId} from "./client-id";
afterEach(()=>vi.unstubAllGlobals());
describe("client UUID",()=>{
 it("supports LAN HTTP without randomUUID",()=>{
   vi.stubGlobal("crypto",{getRandomValues:(bytes:Uint8Array)=>{bytes.fill(165);return bytes;}});
   expect(createClientId()).toBe("a5a5a5a5-a5a5-45a5-a5a5-a5a5a5a5a5a5");
 });
 it("uses native randomUUID when supported",()=>{
   const native=vi.fn(()=>"native-id");vi.stubGlobal("crypto",{randomUUID:native});
   expect(createClientId()).toBe("native-id");expect(native).toHaveBeenCalledOnce();
 });
 it("fails closed without secure randomness",()=>{
   vi.stubGlobal("crypto",undefined);expect(()=>createClientId()).toThrow("Secure randomness");
 });
});
