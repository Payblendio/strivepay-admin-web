import {connectSupport,type SupportConnectionOptions,type SupportConnectionState} from "./support-connection";
type Entry={listeners:Set<SupportConnectionOptions>;state:SupportConnectionState;dispose:()=>void};
const connections=new Map<string,Entry>();
/** Share one connection per account scope within this browser tab. No credentials are cached here. */
export function connectSharedSupport(options:SupportConnectionOptions&{scope:string}):()=>void{
  const {scope,...listener}=options;
  let entry=connections.get(scope);
  if(!entry){
    entry={listeners:new Set([listener]),state:"connecting",dispose:()=>{}};
    connections.set(scope,entry);
    const current=entry;
    current.dispose=connectSupport({
      requestTicket:signal=>{
        const subscriber=current.listeners.values().next().value;
        return subscriber?subscriber.requestTicket(signal):Promise.resolve(null);
      },
      onState:state=>{current.state=state;for(const item of current.listeners)item.onState(state);},
      onChange:()=>{for(const item of current.listeners)item.onChange();},
      onTransactionChange:()=>{for(const item of current.listeners)item.onTransactionChange?.();},
      activity:()=>Array.from(current.listeners).find(item=>item.activity)?.activity?.()??{ticketId:null,typing:false},
      onTyping:state=>{for(const item of current.listeners)item.onTyping?.(state);},
    });
  }else{
    entry.listeners.add(listener);listener.onState(entry.state);
    if(entry.state==="connected")listener.onChange();
  }
  const current=entry;
  return()=>{current.listeners.delete(listener);if(!current.listeners.size){current.dispose();if(connections.get(scope)===current)connections.delete(scope);}};
}
