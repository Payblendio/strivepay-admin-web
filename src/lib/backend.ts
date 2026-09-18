export const API_URL=process.env.CONSUMER_API_URL??"http://127.0.0.1:18080";
export async function backend(path:string,init:RequestInit={}){return fetch(`${API_URL}${path}`,{...init,headers:{Accept:"application/json",...init.headers},cache:"no-store"})}
export async function responseBody(response:Response){const text=await response.text();if(!text)return null;try{return JSON.parse(text)}catch{return {title:"The service returned an unreadable response"}}}
