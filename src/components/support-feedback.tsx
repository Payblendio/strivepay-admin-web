"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
type Feedback={actorId:string;rating:number;comment:string;createdAt:string};
type Props={ticketId:string;revision:number;readOnly?:boolean;request:(path:string,init?:RequestInit)=>Promise<unknown>};
export function SupportFeedback({ticketId,revision,readOnly=false,request}:Props){
  const [items,setItems]=useState<Feedback[]>([]),[rating,setRating]=useState(""),[comment,setComment]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false),[attempt,setAttempt]=useState(0);
  const initialized=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    void request(`tickets/${ticketId}/feedback`,{signal:controller.signal}).then(value=>{
      if(controller.signal.aborted)return;const rows=value as Feedback[];setItems(rows);setError("");
      if(!initialized.current){if(rows[0]){setRating(String(rows[0].rating));setComment(rows[0].comment??"");}initialized.current=true;}
    }).catch(()=>{if(!controller.signal.aborted)setError("Feedback could not be loaded.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[ticketId,revision,request,attempt]);
  async function submit(event:FormEvent){
    event.preventDefault();if(busy||!rating)return;setBusy(true);setError("");setSaved(false);
    try{const result=await request(`tickets/${ticketId}/feedback`,{method:"POST",body:JSON.stringify({rating:Number(rating),comment})});setItems([result as Feedback]);setSaved(true);}
    catch(e){setError(e instanceof Error?e.message:"Feedback could not be saved.");}finally{setBusy(false);}
  }
  return <section className="support-feedback" aria-label="Conversation feedback">
    <h3>{readOnly?"Customer feedback":"How was your support experience?"}</h3>
    {error?<p role="alert">{error} <button onClick={()=>setAttempt(value=>value+1)}>Retry loading</button></p>:null}
    {loading?<p role="status">Loading feedback…</p>:readOnly?<>{items.length?items.map(item=><div key={item.actorId}><strong>{item.rating} / 5</strong>{item.comment?<p>{item.comment}</p>:null}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></div>):<p>No feedback yet.</p>}</>:<form onSubmit={submit}>
      <label>Rating<select required value={rating} disabled={busy||!initialized.current} onChange={event=>{setRating(event.target.value);setSaved(false);}}><option value="">Choose a rating</option>{["Very poor","Poor","Okay","Good","Excellent"].map((name,index)=><option key={name} value={index+1}>{index+1} — {name}</option>)}</select></label>
      <label>Comment (optional)<textarea rows={2} maxLength={2000} disabled={busy||!initialized.current} value={comment} onChange={event=>{setComment(event.target.value);setSaved(false);}}/></label>
      <button disabled={busy||!rating||!initialized.current}>{busy?"Saving…":items.length?"Update feedback":"Send feedback"}</button>
      {saved?<span role="status">Thank you. Your feedback has been saved.</span>:null}
    </form>}
  </section>;
}

