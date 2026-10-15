// @vitest-environment jsdom
import React from "react";
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {RateAlertsPanel} from "./rate-alerts-panel";
const fetcher=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/admin-session",()=>({adminFetch:fetcher}));
vi.mock("@/lib/swal",()=>({promptReason:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("invalidates campaign review when audience or copy changes",async()=>{
  fetcher.mockImplementation(async(path:string)=>({ok:true,json:async()=>path.includes("/runs")?[]:path.endsWith("/force")?{recipients:2,devices:2,samples:[],previewToken:"signed-preview",enabled:true,omissions:{}}:{enabled:true,mode:"TWICE_DAILY",morning:"09:00",evening:"18:00",windowStart:"08:00",windowEnd:"21:00",intervalHours:1,assets:["BTC","USDT"]}}));
  render(<RateAlertsPanel/>);
  fireEvent.change(await screen.findByLabelText("Reason for this send"),{target:{value:"Daily reminder"}});
  fireEvent.click(screen.getByRole("button",{name:"Check audience"}));
  await screen.findByRole("button",{name:"Confirm & send"});
  fireEvent.change(screen.getByLabelText("Country codes"),{target:{value:"NG"}});
  expect(screen.queryByRole("button",{name:"Confirm & send"})).toBeNull();
  expect(fetcher.mock.calls.filter(([,init])=>init?.body&&JSON.parse(init.body).dryRun===false)).toHaveLength(0);
});
