"use client";
import {IconAlertTriangle,IconCheck,IconInfoCircle,IconX} from "@tabler/icons-react";
import {createContext,useCallback,useContext,useState,type ReactNode} from "react";
type Tone="info"|"success"|"warning"|"danger";type Toast={id:number;title:string;message?:string;tone:Tone};const Context=createContext<{show:(toast:Omit<Toast,"id">)=>void}|null>(null);let id=0;
const ICONS={success:IconCheck,info:IconInfoCircle,warning:IconAlertTriangle,danger:IconAlertTriangle};
export function ToastProvider({children}:{children:ReactNode}){
  const[toasts,setToasts]=useState<Toast[]>([]);
  const dismiss=useCallback((key:number)=>setToasts(items=>items.filter(x=>x.id!==key)),[]);
  const show=useCallback((value:Omit<Toast,"id">)=>{const key=++id;setToasts(items=>[...items.filter(item=>item.tone!==value.tone||item.title!==value.title||item.message!==value.message),{...value,id:key}].slice(-3));window.setTimeout(()=>dismiss(key),4800)},[dismiss]);
  return <Context.Provider value={{show}}>{children}<div className="toast-stack" aria-live="polite" aria-relevant="additions removals">{toasts.map(toast=>{const Icon=ICONS[toast.tone];return <section key={toast.id} className={`toast ${toast.tone}`} role={toast.tone==="danger"?"alert":"status"} aria-label={`${toast.title} notification`}><i aria-hidden="true"><Icon size={19} stroke={2.2}/></i><span><strong>{toast.title}</strong>{toast.message&&<small>{toast.message}</small>}</span><button className="floating-close-button toast-close-button" type="button" aria-label="Dismiss notification" onClick={()=>dismiss(toast.id)}><IconX aria-hidden="true" size={18} stroke={2.5}/></button></section>})}</div></Context.Provider>
}
export function useToast(){const value=useContext(Context);if(!value)throw new Error("useToast must be used inside ToastProvider");return value}
