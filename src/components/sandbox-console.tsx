"use client";

import {createClientId} from "@/lib/client-id";

import {FormEvent,useCallback,useEffect,useState} from "react";
import {IconAlertTriangle,IconBuildingBank,IconCheck,IconClock,IconCoins,IconLoader2,IconSearch,IconShieldCheck,IconUser} from "@tabler/icons-react";
import {adminFetch} from "@/lib/admin-session";
import {useToast} from "@/components/ui/toast";

type Environment={mode:string;sandbox:boolean;configured:boolean};
type Target={id:string;type:"PERSON"|"ORGANIZATION";label:string;detail:string;complianceStatus?:string|null;entityStatus?:string|null;sessionActive:boolean;sessionExpiresAt?:string|null};
type Account={id:string;currency:string;status:string;label:string;accountMask?:string|null};
type Accounts={fundingAccounts:Account[];payoutAccounts:Account[]};
const KYC=["KYC_NEEDED","PENDING_KYC_DATA","KYC_PENDING","SOFT_KYC_FAILED","HARD_KYC_FAILED","FULL_USER"];
const KYB=["CREATED","KYB_PENDING","ACTIVE","REJECTED"];
const TOKENS=["USDC","USDT","DAI","EURC"];
const NETWORKS=["ETHEREUM","POLYGON","ARBITRUM","OPTIMISM","BASE","AVALANCHE","BSC"];

async function api<T>(path:string,init:RequestInit={}):Promise<T>{const response=await adminFetch(`/api/admin/provider/sandbox${path}`,{...init,headers:{Accept:"application/json",...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}});const value=await response.json().catch(()=>null) as {title?:string;detail?:string}|T|null;if(!response.ok)throw new Error(value&&typeof value==="object"&&("detail" in value||"title" in value)?value.detail??value.title:"Sandbox operation failed");return value as T;}
function reference(){return `sp_sandbox_${Date.now()}_${createClientId().replaceAll("-","").slice(0,12)}`;}

export function SandboxConsole(){
  const {show}=useToast();const notify=useCallback((tone:"success"|"danger",title:string,message:string)=>show({tone,title,message}),[show]);
  const [environment,setEnvironment]=useState<Environment|null>(null),[kind,setKind]=useState<"PERSON"|"ORGANIZATION">("PERSON"),[query,setQuery]=useState(""),[targets,setTargets]=useState<Target[]>([]),[target,setTarget]=useState<Target|null>(null),[accounts,setAccounts]=useState<Accounts|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  const search=useCallback(async(term:string,type:string)=>{setLoading(true);try{setTargets(await api<Target[]>(`/targets?q=${encodeURIComponent(term)}&type=${type}`));}catch(error){notify("danger","Could not load sandbox records",error instanceof Error?error.message:"Try again");}finally{setLoading(false)}},[notify]);
  useEffect(()=>{void api<Environment>("/environment").then(setEnvironment).catch((error)=>{setEnvironment({mode:"UNAVAILABLE",sandbox:false,configured:false});notify("danger","Sandbox environment unavailable",error instanceof Error?error.message:"Could not reach the sandbox probe.");});},[notify]);
  useEffect(()=>{if(!environment?.sandbox||!environment.configured)return;const timer=window.setTimeout(()=>void search(query,kind),250);return()=>window.clearTimeout(timer);},[environment,query,kind,search]);
  useEffect(()=>{if(!target?.sessionActive)return;const timer=window.setTimeout(()=>void api<Accounts>(`/targets/${target.id}/accounts`).then(setAccounts).catch(error=>notify("danger","Could not load eligible accounts",error instanceof Error?error.message:"Try again")),0);return()=>window.clearTimeout(timer);},[target,notify]);
  function switchKind(value:"PERSON"|"ORGANIZATION"){setKind(value);setTarget(null);setAccounts(null);setQuery("");}
  async function compliance(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!target)return;const form=new FormData(event.currentTarget),operation=target.type==="PERSON"?"kyc":"kyb",status=String(form.get("status"));setBusy(operation);try{await api(`/targets/${target.id}/${operation}`,{method:"PATCH",body:JSON.stringify({status,rejectionReason:String(form.get("rejectionReason")??"").trim()||null,reason:String(form.get("reason")??"")})});setTarget(current=>current?{...current,complianceStatus:status,entityStatus:status}:current);notify("success",`${operation.toUpperCase()} outcome applied`,"The sandbox accepted the verification scenario and the action was audit logged.");await search(query,kind);}catch(error){notify("danger","Verification simulation failed",error instanceof Error?error.message:"Try again");}finally{setBusy("")}}
  async function simulate(event:FormEvent<HTMLFormElement>,direction:"fiat"|"crypto"){
    event.preventDefault();
    if(!target)return;
    const formEl=event.currentTarget;
    const form=new FormData(formEl);
    setBusy(direction);
    const payload=direction==="fiat"
      ?{accountId:String(form.get("accountId")),amount:String(form.get("amount")),paymentMethod:String(form.get("paymentMethod")),reference:String(form.get("reference")),reason:String(form.get("reason"))}
      :{beneficiaryId:String(form.get("beneficiaryId")),amount:String(form.get("amount")),token:String(form.get("token")),network:String(form.get("network")),reason:String(form.get("reason"))};
    try{
      const result=await api<{transactionId:string;status:string}>(`/targets/${target.id}/${direction}`,{method:"POST",body:JSON.stringify(payload)});
      notify("success","Simulation accepted",`Request ${result.transactionId} is ${result.status}. The provider webhook will create or update the transaction record.`);
      if(direction==="fiat"){
        const input=formEl.elements.namedItem("reference");
        if(input instanceof HTMLInputElement)input.value=reference();
      }
    }catch(error){
      notify("danger","Transaction simulation failed",error instanceof Error?error.message:"Try again");
    }finally{
      setBusy("");
    }
  }

  return <div className="sandbox-console">
    <section className={`sandbox-environment ${environment?.sandbox&&environment.configured?"ready":"blocked"}`}>{environment?.sandbox&&environment.configured?<IconShieldCheck size={22}/>:<IconAlertTriangle size={22}/>}<div><strong>{environment?.sandbox&&environment.configured?"Connected to Bakkt sandbox":"Sandbox is not active"}</strong><span>Mode {environment?.mode??"Checking"}. Remote API {environment?.configured?"configured":"not configured"}. Production mode rejects every action on this page.</span></div><b>{environment?.sandbox?"SANDBOX":"LOCKED"}</b></section>
    <section className="sandbox-target-panel"><header><div><span>TEST SUBJECT</span><h2>Select a linked account</h2></div><div className="sandbox-kind"><button className={kind==="PERSON"?"active":""} onClick={()=>switchKind("PERSON")}>Individual</button><button className={kind==="ORGANIZATION"?"active":""} onClick={()=>switchKind("ORGANIZATION")}>Company</button></div></header>{target?<div className="sandbox-selected-target"><span>{target.type==="PERSON"?<IconUser size={20}/>:<IconBuildingBank size={20}/>}</span><div><strong>{target.label}</strong><small>{target.detail}</small></div><i className={target.sessionActive?"ready":""}>{target.sessionActive?"Session active":"Session required"}</i><button onClick={()=>{setTarget(null);setAccounts(null)}}>Change</button></div>:<><label className="sandbox-search"><IconSearch size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={kind==="PERSON"?"Search by name or email":"Search company or registration"}/></label><div className="sandbox-target-results">{loading?<p><IconLoader2 className="spin" size={17}/>Searching linked records</p>:targets.map(item=><button key={item.id} onClick={()=>setTarget(item)}><span>{item.type==="PERSON"?<IconUser size={18}/>:<IconBuildingBank size={18}/>}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><i className={item.sessionActive?"ready":""}>{item.sessionActive?"Ready":"No session"}</i></button>)}</div></>}</section>
    {target?<><section className={`sandbox-session-state ${target.sessionActive?"ready":"blocked"}`}><IconClock size={19}/><div><strong>{target.sessionActive?"Secure provider session is active":"Testing is blocked until the customer signs in again"}</strong><span>{target.sessionExpiresAt?`Expires ${new Date(target.sessionExpiresAt).toLocaleString()}`:"Sandbox mutations require a current customer verification session."}</span></div></section>
    <div className="sandbox-action-grid">
      <form className="sandbox-action-card" onSubmit={compliance}><header><IconShieldCheck size={20}/><div><span>COMPLIANCE</span><h3>{target.type==="PERSON"?"KYC outcome":"KYB outcome"}</h3></div></header><p>Move this account through a provider verification result for onboarding tests.</p><label>Current status<strong>{target.complianceStatus??target.entityStatus??"Not reported"}</strong></label><label>Test outcome<select name="status" defaultValue={target.type==="PERSON"?"FULL_USER":"ACTIVE"}>{(target.type==="PERSON"?KYC:KYB).map(item=><option key={item}>{item}</option>)}</select></label><label>Provider rejection reason<textarea name="rejectionReason" maxLength={1024} placeholder="Required for failed or rejected outcomes"/></label><label>Audit reason<input name="reason" required placeholder="Why this scenario is being tested"/></label><button disabled={!target.sessionActive||!!busy}>{busy==="kyc"||busy==="kyb"?<IconLoader2 className="spin" size={16}/>:<IconCheck size={16}/>}Apply outcome</button></form>
      <form className="sandbox-action-card" onSubmit={event=>void simulate(event,"fiat")}><header><IconBuildingBank size={20}/><div><span>FIAT TO CRYPTO</span><h3>Simulate bank pay-in</h3></div></header><p>Post a sandbox credit to an existing managed fiat account.</p><label>Managed account<select name="accountId" required defaultValue=""><option value="">Choose account</option>{accounts?.fundingAccounts.map(item=><option value={item.id} key={item.id}>{item.currency} · {item.label} · {item.status}</option>)}</select></label><div className="sandbox-field-row"><label>Amount<input name="amount" inputMode="decimal" required placeholder="1000.00"/></label><label>Rail<select name="paymentMethod"><option value="">Default</option><option>ACH</option><option>WIRE</option></select></label></div><label>Reference<input name="reference" defaultValue={reference()} readOnly/></label><label>Audit reason<input name="reason" required placeholder="Scenario or test case"/></label><button disabled={!target.sessionActive||!accounts?.fundingAccounts.length||!!busy}>{busy==="fiat"?<IconLoader2 className="spin" size={16}/>:<IconBuildingBank size={16}/>}Simulate pay-in</button></form>
      <form className="sandbox-action-card" onSubmit={event=>void simulate(event,"crypto")}><header><IconCoins size={20}/><div><span>CRYPTO TO FIAT</span><h3>Simulate crypto deposit</h3></div></header><p>Post a stablecoin deposit and route proceeds to a verified payout account.</p><label>Payout beneficiary<select name="beneficiaryId" required defaultValue=""><option value="">Choose beneficiary</option>{accounts?.payoutAccounts.map(item=><option value={item.id} key={item.id}>{item.currency} · {item.label} · {item.status}</option>)}</select></label><div className="sandbox-field-row"><label>Amount<input name="amount" inputMode="decimal" required placeholder="250.00"/></label><label>Token<select name="token">{TOKENS.map(item=><option key={item}>{item}</option>)}</select></label></div><label>Network<select name="network" defaultValue="POLYGON">{NETWORKS.map(item=><option key={item}>{item}</option>)}</select></label><label>Audit reason<input name="reason" required placeholder="Scenario or test case"/></label><button disabled={!target.sessionActive||!accounts?.payoutAccounts.length||!!busy}>{busy==="crypto"?<IconLoader2 className="spin" size={16}/>:<IconCoins size={16}/>}Simulate deposit</button></form>
    </div></>:null}
  </div>;
}
