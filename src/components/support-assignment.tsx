"use client";
import {useEffect,useState,type FormEvent} from "react";
type Agent={id:string;displayName:string};
type Props={ticketId:string;assignedAdminId:string|null;priority:string|null;request:(path:string,init?:RequestInit)=>Promise<unknown>;onSaved:()=>void};
export function SupportAssignment({ticketId,assignedAdminId,priority,request,onSaved}:Props){
  const [agents,setAgents]=useState<Agent[]>([]),[agent,setAgent]=useState(assignedAdminId??""),[level,setLevel]=useState(priority??"NORMAL");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);
    void request("agents",{signal:controller.signal}).then(value=>{if(!controller.signal.aborted){setAgents(value as Agent[]);setError("");}})
      .catch(()=>{if(!controller.signal.aborted)setError("Agents could not be loaded.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[request,attempt]);
  async function save(event:FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try{await request(`tickets/${ticketId}/assignment`,{method:"POST",body:JSON.stringify({adminId:agent||null,priority:level})});onSaved();}
    catch(e){setError(e instanceof Error?e.message:"Assignment could not be saved.");}finally{setBusy(false);}
  }
  return <form className="support-assignment" onSubmit={save} aria-label="Manage assignment">
    <label>Support agent<select value={agent} disabled={loading||busy} onChange={event=>setAgent(event.target.value)}><option value="">Unassigned</option>{agent&&!agents.some(item=>item.id===agent)?<option value={agent} disabled>Previously assigned agent</option>:null}{agents.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
    <label>Priority<select value={level} disabled={busy} onChange={event=>setLevel(event.target.value)}>{["LOW","NORMAL","HIGH","URGENT"].map(value=><option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label>
    <button disabled={loading||busy||(agent===(assignedAdminId??"")&&level===(priority??"NORMAL"))}>{busy?"Saving…":"Save assignment"}</button>
    {error?<p role="alert">{error} <button type="button" onClick={()=>setAttempt(value=>value+1)}>Reload agents</button></p>:null}
  </form>;
}
