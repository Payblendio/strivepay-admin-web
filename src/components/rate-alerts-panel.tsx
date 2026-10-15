"use client";

import {useCallback,useEffect,useState} from "react";
import {adminFetch} from "@/lib/admin-session";
import {promptReason} from "@/lib/swal";
import {Badge,Button,Notice,SegmentedControl,type Tone} from "@/components/ui/primitives";
import {DataTable} from "@/components/ui/data-table";
import "./rate-alerts-panel.css";

type Settings={enabled:boolean;mode:"TWICE_DAILY"|"HOURLY";morning:string;evening:string;intervalHours:number;windowStart:string;windowEnd:string;assets:string[]};
type Sample={title:string;body:string;currency?:string;omissions?:string[]};
type Preview={recipients:number;devices:number;samples:Sample[];previewToken:string;enabled:boolean;omissions:Record<string,string>};
type Run={id:string;trigger:string;started_at:string;status:string;recipients:number;devices:number;accepted:number;failed:number;expired:number;suppressed:number;pending:number;oldest_pending_at?:string;reason?:string;admin_id?:string;audience?:unknown;omissions?:unknown};
const ASSETS=["USDC","USDT","BTC","ETH","USD","EUR"];
async function api<T>(path:string,method="GET",body?:unknown):Promise<T>{const response=await adminFetch(`/api/admin/rate-alerts${path}`,{method,headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.title??data.detail??"Rate alerts are unavailable");return data as T;}
const split=(text:string)=>text.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
const number=(value:number|undefined)=>(value??0).toLocaleString("en-US");
function statusTone(status:string):Tone{const s=status.toUpperCase();if(/COMPLETE|SENT|SUCCE/.test(s))return "success";if(/FAIL|CANCEL|ERROR/.test(s))return "danger";if(/PEND|QUEUE|RUN|PROCESS/.test(s))return "warning";return "neutral";}

function PushSample({sample}:{sample:Sample}){
  return <article className="ra-push"><header><span className="ra-push-app">StrivePay</span><span>now</span></header><strong>{sample.title}</strong><p>{sample.body}</p>{sample.omissions?.length?<small>Omitted: {sample.omissions.join(" · ")}</small>:null}</article>;
}

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

  const schedule=settings?settings.mode==="TWICE_DAILY"?`${settings.morning} and ${settings.evening}`:`Every ${settings.intervalHours} hour${settings.intervalHours===1?"":"s"}`:"";

  return <div className="ra">
    <div className="ra-live" role="status" aria-live="polite">{busy?"Working…":""}</div>
    {notice?<Notice tone="success" title="Done">{notice}</Notice>:null}
    {error?<Notice tone="danger" title="Rate alerts" action={<Button variant="secondary" size="small" onClick={()=>void action(load)}>Retry loading</Button>}>{error}</Notice>:null}
    {!settings?<div className="ops-loading"><span className="ops-spinner" aria-hidden="true"/>Loading rate alert settings…</div>:<>
      <section className="ops-stat-grid ra-stats" aria-label="Rate alert summary">
        <article className={`ops-stat-card ${settings.enabled?"ready":"not-ready"}`}><span>Status</span><strong>{settings.enabled?"Enabled":"Paused"}</strong><small>One combined push per recipient</small></article>
        <article className="ops-stat-card"><span>Schedule</span><strong>{settings.mode==="TWICE_DAILY"?"Twice daily":"Interval"}</strong><small>{schedule} · user local time</small></article>
        <article className="ops-stat-card"><span>Sending window</span><strong>{settings.windowStart}–{settings.windowEnd}</strong><small>Applies to interval and manual sends</small></article>
        <article className="ops-stat-card"><span>Currencies</span><strong>{settings.assets.length} of {ASSETS.length}</strong><small>{settings.assets.join(" · ")||"None approved"}</small></article>
      </section>

      <div className="ra-split">
        <section className="ops-panel ra-panel" aria-labelledby="ra-schedule-title">
          <header className="ops-panel-heading"><div><span>Delivery schedule</span><h2 id="ra-schedule-title">{settings.enabled?"Rate alerts enabled":"Rate alerts paused"}</h2></div><Button variant="danger" size="small" disabled={busy||!settings.enabled} onClick={()=>void stop()}>Stop &amp; cancel pending</Button></header>
          <p className="ops-panel-copy">Users can opt out of any category or currency in their app or web settings.</p>
          <fieldset disabled={busy} className="ra-fields"><legend className="ra-sr">Schedule settings</legend>
            <label className="ops-check-row"><input type="checkbox" checked={settings.enabled} onChange={e=>change({enabled:e.target.checked})}/><span><strong>Enable rate alerts</strong><small>Scheduled digests run while enabled</small></span></label>
            <div className="ra-field"><span className="ra-label">Mode</span><SegmentedControl value={settings.mode} onChange={v=>change({mode:v as Settings["mode"]})} options={[{value:"TWICE_DAILY",label:"Twice daily"},{value:"HOURLY",label:"Every few hours"}]}/></div>
            {settings.mode==="TWICE_DAILY"
              ?<div className="ra-grid"><label className="ra-field"><span className="ra-label">First local send</span><input type="time" value={settings.morning} onChange={e=>change({morning:e.target.value})}/></label><label className="ra-field"><span className="ra-label">Second local send</span><input type="time" value={settings.evening} onChange={e=>change({evening:e.target.value})}/></label></div>
              :<label className="ra-field"><span className="ra-label">Interval</span><select value={settings.intervalHours} onChange={e=>change({intervalHours:Number(e.target.value)})}>{[1,2,3,6,12].map(v=><option key={v} value={v}>Every {v} hour{v===1?"":"s"}</option>)}</select></label>}
            <div className="ra-grid"><label className="ra-field"><span className="ra-label">Window starts</span><input type="time" value={settings.windowStart} onChange={e=>change({windowStart:e.target.value})}/></label><label className="ra-field"><span className="ra-label">Window ends</span><input type="time" value={settings.windowEnd} onChange={e=>change({windowEnd:e.target.value})}/></label></div>
            <fieldset className="ra-assets"><legend className="ra-label">Approved currencies · maximum six</legend>{ASSETS.map(code=><label key={code} className="ops-check-row"><input type="checkbox" checked={settings.assets.includes(code)} onChange={e=>change({assets:e.target.checked?[...settings.assets,code]:settings.assets.filter(a=>a!==code)})}/><span><strong>{code}</strong></span></label>)}</fieldset>
            <div className="ra-footer"><Button onClick={()=>void save()} loading={busy}>Save settings</Button></div>
          </fieldset>
        </section>

        <section className="ops-panel ra-panel" aria-labelledby="ra-preview-title">
          <header className="ops-panel-heading"><div><span>Message check</span><h2 id="ra-preview-title">Preview &amp; test</h2></div></header>
          <p className="ops-panel-copy">Market prices are indicative. Missing or stale pairs are omitted from the message.</p>
          <label className="ra-field"><span className="ra-label">Local currency</span><input maxLength={3} value={currency} onChange={e=>{setCurrency(e.target.value.toUpperCase());setSample(null);}}/></label>
          <div className="ra-actions"><Button variant="secondary" disabled={busy} onClick={()=>void action(async()=>setSample(await api<Sample>(`/preview?currency=${encodeURIComponent(currency)}`)))}>Preview saved settings</Button><Button variant="quiet" disabled={busy} onClick={()=>void action(async()=>{const result=await api<{devices:number}>("/test","POST",{});setNotice(`Test queued for ${result.devices} eligible device(s) linked to your admin email.`);await load();})}>Send to my test device</Button></div>
          {sample?<PushSample sample={sample}/>:<div className="ra-empty">Run a preview to see the exact push for this currency.</div>}
        </section>
      </div>

      <section className="ops-panel ra-panel" aria-labelledby="ra-send-title">
        <header className="ops-panel-heading"><div><span>Manual campaign</span><h2 id="ra-send-title">Send now</h2></div></header>
        <p className="ops-panel-copy">Filters intersect; empty filters include every eligible recipient. Opt-outs and the one-hour minimum gap always apply.</p>
        <fieldset disabled={busy} className="ra-fields" onChange={()=>setPreview(null)}><legend className="ra-sr">Audience and message</legend>
          <div className="ra-grid ra-grid-3">
            <label className="ra-field"><span className="ra-label">Country codes</span><input value={countries} placeholder="NG, GB" onChange={e=>setCountries(e.target.value)}/></label>
            <label className="ra-field"><span className="ra-label">Local currencies</span><input value={currencies} placeholder="NGN, GBP" onChange={e=>setCurrencies(e.target.value)}/></label>
            <label className="ra-field"><span className="ra-label">Optional title</span><input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="NGN indicative rates"/></label>
          </div>
          <label className="ra-field"><span className="ra-label">Customer emails or IDs · up to 5,000</span><textarea rows={3} value={recipients} onChange={e=>setRecipients(e.target.value)} placeholder="Separate entries with commas or new lines"/></label>
          <fieldset className="ra-assets"><legend className="ra-label">Include currencies · none selected means all approved</legend>{settings.assets.map(a=><label key={a} className="ops-check-row"><input type="checkbox" checked={assets.includes(a)} onChange={e=>setAssets(e.target.checked?[...assets,a]:assets.filter(x=>x!==a))}/><span><strong>{a}</strong></span></label>)}</fieldset>
          <div className="ra-grid">
            <label className="ra-field"><span className="ra-label">Optional closing line</span><input maxLength={120} value={closingLine} onChange={e=>setClosingLine(e.target.value)} placeholder="Tap to view rates and convert"/></label>
            <label className="ra-field"><span className="ra-label">Reason for this send</span><input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
          </div>
          <label className="ops-check-row ra-inline"><input type="checkbox" checked={respectWindow} onChange={e=>setRespectWindow(e.target.checked)}/><span><strong>Respect the local sending window</strong><small>Untick only for urgent sends</small></span></label>
          <div className="ra-footer"><Button variant="secondary" disabled={!reason.trim()} onClick={()=>void action(async()=>{setPreview(await api<Preview>("/force","POST",{...campaign(),dryRun:true}));setKey(crypto.randomUUID());})}>Check audience</Button></div>
        </fieldset>
        {preview?<div className="ra-review">
          <div className="ra-review-head"><h3>Review this send</h3><div className="ra-review-metrics"><span><small>Recipients</small><strong>{number(preview.recipients)}</strong></span><span><small>Devices</small><strong>{number(preview.devices)}</strong></span></div></div>
          <p className="ops-panel-copy">Eligibility is checked again before sending, so counts can drop as preferences change.</p>
          {preview.samples.length?<div className="ra-samples">{preview.samples.map((m,i)=><PushSample key={i} sample={m}/>)}</div>:null}
          {Object.values(preview.omissions).map((v,i)=><p className="ra-omission" key={i}>{v}</p>)}
          {!preview.enabled?<Notice tone="warning" title="Rate alerts are paused">Enable and save rate alerts before sending a campaign.</Notice>:null}
          <div className="ra-footer"><Button disabled={busy||!preview.enabled||preview.devices===0} onClick={()=>void action(async()=>{const result=await api<{devices:number}>("/force","POST",{...campaign(),dryRun:false,previewToken:preview.previewToken,idempotencyKey:key});setNotice(`Campaign queued${result.devices===undefined?"":` for ${result.devices} devices`}.`);setPreview(null);await load();})}>Confirm &amp; send</Button></div>
        </div>:null}
      </section>

      <section className="ops-panel ra-panel" aria-labelledby="ra-runs-title">
        <header className="ops-panel-heading"><div><span>Delivery log</span><h2 id="ra-runs-title">Recent runs</h2></div><Button variant="secondary" size="small" disabled={busy} onClick={()=>void action(load)}>Refresh</Button></header>
        <p className="ops-panel-copy">Accepted means accepted by the push provider, not confirmed on the device.</p>
        <DataTable
          columns={[
            {key:"started",header:"Started",render:r=>new Date(r.started_at).toLocaleString()},
            {key:"trigger",header:"Trigger",render:r=><Badge tone={r.trigger==="FORCED"?"info":"neutral"}>{r.trigger}</Badge>},
            {key:"status",header:"Status",render:r=><Badge tone={statusTone(r.status)} dot>{r.status}</Badge>},
            {key:"recipients",header:"Recipients",align:"right",render:r=>number(r.recipients)},
            {key:"devices",header:"Devices",align:"right",render:r=>number(r.devices)},
            {key:"pending",header:"Queued",align:"right",render:r=>number(r.pending)},
            {key:"accepted",header:"Accepted",align:"right",render:r=>number(r.accepted)},
            {key:"failed",header:"Failed",align:"right",render:r=>number(r.failed)},
            {key:"expired",header:"Expired",align:"right",render:r=>number(r.expired)},
            {key:"suppressed",header:"Suppressed",align:"right",render:r=>number(r.suppressed)},
            {key:"details",header:"Details",render:r=><details className="ra-details"><summary>View</summary><p>{r.reason||"Scheduled run"}</p><p>Admin: {r.admin_id||"Scheduler"}</p>{r.oldest_pending_at?<p>Oldest queued: {new Date(r.oldest_pending_at).toLocaleString()}</p>:null}<pre>{JSON.stringify({audience:r.audience,omissions:r.omissions},null,2)}</pre></details>},
          ]}
          rows={runs}
          getKey={r=>r.id}
          empty="No runs on this page."
        />
        <div className="ra-pager"><Button variant="secondary" size="small" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page+1}</span><Button variant="secondary" size="small" disabled={busy||runs.length<25} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
      </section>
    </>}
  </div>;
}
