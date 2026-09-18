import {z} from "zod";
export const supportId=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const instant=z.string().refine(value=>Number.isFinite(Date.parse(value)));
const amount=z.string().regex(/^-?\d{1,38}(?:\.\d{1,18})?$/).nullable();
export const investigationContext=z.object({
 activity:z.object({kind:z.enum(["RAMP","CONVERSION","ORDER"]),id:supportId}).nullable(),
 facts:z.object({direction:z.string(),status:z.string(),sourceAsset:z.string().nullable(),sourceAmount:amount,destinationAsset:z.string().nullable(),destinationAmount:amount,createdAt:instant}).nullable(),
}).refine(value=>(value.activity===null)===(value.facts===null));
export const investigationHistory=z.object({items:z.array(z.object({id:supportId,status:z.string(),occurredAt:instant})).max(100),before:supportId.nullable(),hasMore:z.boolean()})
 .refine(value=>value.hasMore?value.items.length>0&&value.before===value.items.at(-1)?.id:value.before===null);
export function recordedAmount(value:string|null,asset:string|null){
 if(value===null)return "Not recorded";
 const [whole,fraction]=value.split(".");
 return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")}${fraction?"."+fraction:""} ${asset??""}`.trim();
}
