import {afterEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {POST} from "./route";
const mocks=vi.hoisted(()=>({backend:vi.fn(),token:"test-only"}));
vi.mock("@/lib/backend",()=>({backend:mocks.backend,responseBody:(response:Response)=>response.json()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>mocks.token?{value:mocks.token}:undefined})}));
vi.mock("@/lib/admin-access",()=>({ACCESS_COOKIE:"admin_access"}));
afterEach(()=>{vi.unstubAllEnvs();mocks.backend.mockReset();mocks.token="test-only";});
const context=()=>({params:Promise.resolve({path:["socket-ticket"]})});
function request(origin?:string,host="localhost:18084"){
 return new NextRequest("http://0.0.0.0:18084/api/admin/support/socket-ticket",{method:"POST",headers:{host,...(origin?{origin}:{})}});
}
it("returns a browser-reachable socket URL when Next uses an internal bind address",async()=>{
 vi.stubEnv("SUPPORT_WEBSOCKET_URL","");
 mocks.backend.mockResolvedValue(Response.json({connectionToken:"test-ticket"}));
 const response=await POST(request("http://localhost:18084"),context());
 expect(response.status).toBe(200);
 expect((await response.json()).websocketUrl).toBe("ws://localhost:18080/v1/support/socket");
 expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each([undefined,"https://foreign.invalid"])("rejects missing or foreign origin %s before issuing credentials",async origin=>{
 expect((await POST(request(origin),context())).status).toBe(403);
 expect(mocks.backend).not.toHaveBeenCalled();
});
it("does not issue a socket ticket without an admin session",async()=>{
 mocks.token="";
 expect((await POST(request("http://localhost:18084"),context())).status).toBe(401);
 expect(mocks.backend).not.toHaveBeenCalled();
});
it("uses the configured secure endpoint behind a production proxy",async()=>{
 vi.stubEnv("SUPPORT_WEBSOCKET_URL","wss://api.example.test/v1/support/socket");
 mocks.backend.mockResolvedValue(Response.json({connectionToken:"test-ticket"}));
 const req=request("https://ops.example.test","internal:3000");
 req.headers.set("x-forwarded-host","ops.example.test");
 req.headers.set("x-forwarded-proto","https");
 const response=await POST(req,context());
 expect(response.status).toBe(200);
 expect((await response.json()).websocketUrl).toBe("wss://api.example.test/v1/support/socket");
});
