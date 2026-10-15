"use client";

import {useCallback,useEffect,useState} from "react";
import {adminFetch} from "@/lib/admin-session";
import {promptReason} from "@/lib/swal";
import "./rate-alerts-panel.css";

type Settings={enabled:boolean;mode:"TWICE_DAILY"|"HOURLY";morning:string;evening:string;intervalHours:number;windowStart:string;windowEnd:string;assets:string[]};
type Sample={title:string;body:string;currency?:string;omissions?:string[]};
type Preview={recipients:number;devices:number;samples:Sample[];previewToken:string;enabled:boolean;omissions:Record<string,string>};
type Run={id:string;trigger:string;started_at:string;status:string;recipients:number;devices:number;accepted:number;failed:number;expired:number;suppressed:number;pending:number;oldest_pending_at?:string;reason?:string;admin_id?:string;audience?:unknown;omissions?:unknown};
const ASSETS=["USDC","USDT","BTC","ETH","USD","EUR"];
async function api<T>(path:string,method="GET",body?:unknown):Promise<T>{const response=await adminFetch(`/api/admin/rate-alerts${path}`,{method,headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.title??data.detail??"Rate alerts are unavailable");return data as T;}
const split=(text:string)=>text.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
export function RateAlertsPanel(){
  const [settings,setSettings]=useState<Settings|null>(null),[runs,setRuns]=useState<Run[]>([]),[page,setPage]=useState(0);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[currency,setCurrency]=useState("NGN"),[sample,setSample]=useState<Sample|null>(null);
  const [countries,setCountries]=useState(""),[currencies,setCurrencies]=useState(""),[recipients,setRecipients]=useState(""),[assets,setAssets]=useState<string[]>([]),[respectWindow,setRespectWindow]=useState(true),[title,setTitle]=useState(""),[closingLine,setClosingLine]=useState(""),[reason,setReason]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null),[key,setKey]=useState("");
  const load=useCallback(async()=>{const [s,r]=await Promise.all([api<Settings>(""),api<Run[]>(`/runs?page=${page}`)]);setSettings(s);setRuns(r);},[page]);
  useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
  async function action(fn:()=>Promise<void>){setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Operation failed");}finally{setBusy(false);}}
  function change(part:Partial<Settings>){setSettings(s=>s?{...s,...part}:s);setPreview(null);setSample(null);}
  function audience(){return {countries:split(countries),currencies:split(currencies),recipients:split(recipients),assets};}
  function campaign(){return {audience:audience(),respectWindow,title,closingLine,reason};}
  async function save(){if(!settings)return;const explanation=await promptReason({title:"Save rate alert settings",text:"Record why this schedule or currency selection is changing.",confirmLabel:"Save settings"});if(!explanation)return;await action(async()=>{setSettings(await api<Settings>("","PUT",{...settings,reason:explanation}));setPreview(null);setNotice("Settings saved. The schedule uses each user's local time.");});}
  async function stop(){const explanation=await promptReason({title:"Stop rate alerts",text:"Pending rate digests will be cancelled. Already accepted pushes cannot be recalled.",confirmLabel:"Stop alerts"});if(!explanation)return;await action(async()=>{setSettings(await api<Settings>("","PUT",{enabled:false,reason:explanation}));setPreview(null);setNotice("Rate alerts stopped; pending digests cancelled.");});}
  return <div className="rate-alerts-panel">
    <div role="status" aria-live="polite">{busy?"Working…":notice}</div>
    {error?<div className="rate-alert-error" role="alert">{error} <button type="button" onClick={()=>void action(load)}>Retry loading</button></div>:null}
    {!settings?<p>Loading rate alert settings…</p>:<>
      <section className="ops-panel rate-alert-section"><header><div><span className="rate-alert-kicker">Delivery schedule</span><h2>{settings.enabled?"Rate alerts enabled":"Rate alerts paused"}</h2><p>One combined push per recipient. Users can opt out of any category or currency.</p></div><button type="button" disabled={busy} onClick={()=>void stop()}>Stop & cancel pending</button></header>
        <fieldset disabled={busy} className="rate-alert-fields"><legend>Schedule settings</legend>
          <label className="rate-alert-check"><input type="checkbox" checked={settings.enabled} onChange={e=>change({enabled:e.target.checked})}/> Enable rate alerts</label>
          <div className="rate-alert-options" role="radiogroup" aria-label="Schedule mode">{(["TWICE_DAILY","HOURLY"] as const).map(mode=><label key={mode}><input type="radio" name="schedule-mode" checked={settings.mode===mode} onChange={()=>change({mode})}/>{mode==="TWICE_DAILY"?"Twice daily":"Every few hours"}</label>)}</div>
          {settings.mode==="TWICE_DAILY"?<div className="rate-alert-grid"><label className="sp-field">First local send<input type="time" value={settings.morning} onChange={e=>change({morning:e.target.value})}/></label><label className="sp-field">Second local send<input type="time" value={settings.evening} onChange={e=>change({evening:e.target.value})}/></label></div>:<label className="sp-field">Interval<select value={settings.intervalHours} onChange={e=>change({intervalHours:Number(e.target.value)})}>{[1,2,3,6,12].map(v=><option key={v} value={v}>Every {v} hour{v===1?"":"s"}</option>)}</select></label>}
          <div className="rate-alert-grid"><label className="sp-field">Window starts<input type="time" value={settings.windowStart} onChange={e=>change({windowStart:e.target.value})}/></label><label className="sp-field">Window ends<input type="time" value={settings.windowEnd} onChange={e=>change({windowEnd:e.target.value})}/></label></div>
          <p>The window applies to interval schedules and manual sends. Twice-daily mode uses the two selected times.</p>
          <fieldset className="rate-alert-options"><legend>Approved currencies · maximum six</legend>{ASSETS.map(code=><label key={code}><input type="checkbox" checked={settings.assets.includes(code)} onChange={e=>change({assets:e.target.checked?[...settings.assets,code]:settings.assets.filter(a=>a!==code)})}/>{code}</label>)}</fieldset>
          <button type="button" className="sp-button sp-button-primary" onClick={()=>void save()}>Save settings</button>
        </fieldset>
      </section>
      <section className="ops-panel rate-alert-section"><header><div><span className="rate-alert-kicker">Message check</span><h2>Preview & test</h2><p>Market prices are indicative. Missing or stale pairs are omitted.</p></div></header>
        <div className="rate-alert-actions"><label className="sp-field">Local currency<input maxLength={3} value={currency} onChange={e=>{setCurrency(e.target.value.toUpperCase());setSample(null);}}/></label><button type="button" disabled={busy} onClick={()=>void action(async()=>setSample(await api<Sample>(`/preview?currency=${encodeURIComponent(currency)}`)))}>Preview saved settings</button><button type="button" disabled={busy} onClick={()=>void action(async()=>{const result=await api<{devices:number}>("/test","POST",{});setNotice(`Test queued for ${result.devices} eligible device(s) linked to your admin email.`);await load();})}>Send to my test device</button></div>
        {sample?<article className="rate-alert-message"><strong>{sample.title}</strong><p>{sample.body}</p>{sample.omissions?.length?<small>{sample.omissions.join(" · ")}</small>:null}</article>:null}
      </section>
      <section className="ops-panel rate-alert-section"><header><div><span className="rate-alert-kicker">Manual campaign</span><h2>Send now</h2><p>Filters intersect. Empty filters include all eligible recipients. Opt-outs and the one-hour minimum gap always apply.</p></div></header>
        <fieldset disabled={busy} className="rate-alert-fields" onChange={()=>setPreview(null)}><legend>Audience and message</legend>
          <div className="rate-alert-grid"><label className="sp-field">Country codes<input value={countries} placeholder="NG, GB" onChange={e=>setCountries(e.target.value)}/></label><label className="sp-field">Local currencies<input value={currencies} placeholder="NGN, GBP" onChange={e=>setCurrencies(e.target.value)}/></label></div>
          <label className="sp-field">Customer emails or IDs · up to 5,000<textarea rows={3} value={recipients} onChange={e=>setRecipients(e.target.value)} placeholder="Separate entries with commas or new lines"/></label>
          <fieldset className="rate-alert-options"><legend>Include currencies · none selected means all approved</legend>{settings.assets.map(a=><label key={a}><input type="checkbox" checked={assets.includes(a)} onChange={e=>setAssets(e.target.checked?[...assets,a]:assets.filter(x=>x!==a))}/>{a}</label>)}</fieldset>
          <label className="rate-alert-check"><input type="checkbox" checked={respectWindow} onChange={e=>setRespectWindow(e.target.checked)}/> Respect the local sending window</label>
          <div className="rate-alert-grid"><label className="sp-field">Optional title<input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="NGN indicative rates"/></label><label className="sp-field">Optional closing line<input maxLength={120} value={closingLine} onChange={e=>setClosingLine(e.target.value)} placeholder="Tap to view rates and convert"/></label></div>
          <label className="sp-field">Reason for this send<input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
          <button type="button" disabled={!reason.trim()} onClick={()=>void action(async()=>{setPreview(await api<Preview>("/force","POST",{...campaign(),dryRun:true}));setKey(crypto.randomUUID());})}>Check audience</button>
        </fieldset>
        {preview?<div className="rate-alert-review"><h3>Review this send</h3><p><strong>{preview.recipients.toLocaleString()} recipients</strong> · {preview.devices.toLocaleString()} devices</p><p>Eligibility is checked again before sending. Counts can decrease as preferences change.</p>{preview.samples.map((m,i)=><article className="rate-alert-message" key={i}><strong>{m.title}</strong><p>{m.body}</p>{m.omissions?.length?<small>{m.omissions.join(" · ")}</small>:null}</article>)}{Object.values(preview.omissions).map((v,i)=><p key={i}>{v}</p>)}<button type="button" className="sp-button sp-button-primary" disabled={busy||!preview.enabled||preview.devices===0} onClick={()=>void action(async()=>{const result=await api<{devices:number}>("/force","POST",{...campaign(),dryRun:false,previewToken:preview.previewToken,idempotencyKey:key});setNotice(`Campaign queued${result.devices===undefined?"":` for ${result.devices} devices`}.`);setPreview(null);await load();})}>Confirm & send</button>{!preview.enabled?<p>Enable and save rate alerts before sending a campaign.</p>:null}</div>:null}
      </section>
      <section className="ops-panel rate-alert-section"><header><div><h2>Recent runs</h2><p>Accepted means accepted by the push provider, not confirmed on the device.</p></div><button type="button" disabled={busy} onClick={()=>void action(load)}>Refresh</button></header>
        <div className="rate-alert-table"><table><thead><tr>{["Started","Trigger","Status","Recipients","Devices","Queued","Accepted","Failed","Expired","Suppressed","Details"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{new Date(r.started_at).toLocaleString()}</td><td>{r.trigger}</td><td>{r.status}</td><td>{r.recipients}</td><td>{r.devices}</td><td>{r.pending}</td><td>{r.accepted}</td><td>{r.failed}</td><td>{r.expired}</td><td>{r.suppressed}</td><td><details><summary>View</summary><p>{r.reason||"Scheduled run"}</p><p>Admin: {r.admin_id||"Scheduler"}</p>{r.oldest_pending_at?<p>Oldest queued: {new Date(r.oldest_pending_at).toLocaleString()}</p>:null}<pre>{JSON.stringify({audience:r.audience,omissions:r.omissions},null,2)}</pre></details></td></tr>)}</tbody></table>{!runs.length?<p>No runs on this page.</p>:null}</div>
        <div className="rate-alert-actions"><button type="button" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button type="button" disabled={busy||runs.length<25} onClick={()=>setPage(p=>p+1)}>Next</button></div>
      </section>
    </>}
  </div>;
}
