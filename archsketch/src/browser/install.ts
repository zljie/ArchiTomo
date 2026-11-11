import { createBrowserApi, type Kv } from './backend.ts';
import { resolveAiConfig, type AiConfig } from '../../server/ai.ts';
/** 静态部署（VITE_ARCHSKETCH_BROWSER=1）时接管同源 /api 请求，改由浏览器版后端处理。 */
export const BROWSER_MODE=import.meta.env.VITE_ARCHSKETCH_BROWSER==='1';
const AI_KEY='archsketch:ai-config';
export type AiSettings={provider:string;baseUrl:string;model:string;apiKey:string};
export function readAiSettings():AiSettings{const d=resolveAiConfig({});let saved:Partial<AiSettings>={};try{saved=JSON.parse(localStorage.getItem(AI_KEY)||'{}');}catch{}return {provider:saved.provider||d.provider||'deepseek',baseUrl:saved.baseUrl||d.baseUrl,model:saved.model||d.model,apiKey:saved.apiKey||''};}
export function writeAiSettings(s:AiSettings|null){try{if(s)localStorage.setItem(AI_KEY,JSON.stringify(s));else localStorage.removeItem(AI_KEY);}catch{}}

function openKv():Kv{
 const db=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('archsketch',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const run=<T>(mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest):Promise<T>=>db.then(d=>new Promise<T>((resolve,reject)=>{const t=d.transaction('kv',mode);const req=fn(t.objectStore('kv'));t.oncomplete=()=>resolve(req.result as T);t.onerror=t.onabort=()=>reject(t.error||req.error);}));
 return {
  get:key=>run('readonly',s=>s.get(key)),
  set:async(key,value)=>{await run('readwrite',s=>s.put(value,key));},
  del:async key=>{await run('readwrite',s=>s.delete(key));},
  keys:async prefix=>((await run<IDBValidKey[]>('readonly',s=>s.getAllKeys(IDBKeyRange.bound(prefix,prefix+'￿')))) as string[]),
 };
}

export function installBrowserBackend(){
 const handle=createBrowserApi(openKv(),()=>readAiSettings() as AiConfig);
 void navigator.storage?.persist?.().catch(()=>{});
 const original=window.fetch.bind(window);
 window.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return original(input,init);
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  let body:unknown;if(method==='POST'){try{body=JSON.parse(typeof init?.body==='string'?init.body:'');}catch{body=null;}}
  const r=await handle(method,url.pathname,body,init?.signal||new AbortController().signal);
  if(init?.signal?.aborted)throw new DOMException('已取消','AbortError');
  return r.body!==undefined?new Response(r.body,{status:r.status,headers:{'Content-Type':r.type||'text/plain'}}):new Response(JSON.stringify(r.json),{status:r.status,headers:{'Content-Type':'application/json; charset=utf-8'}});
 };
 // 交付包下载链接是普通 <a href="/api/...">，静态托管上没有这个地址：拦截后从浏览器存储取出再下载
 document.addEventListener('click',e=>{
  const a=(e.target as Element|null)?.closest?.('a[href^="/api/"]') as HTMLAnchorElement|null;if(!a||e.defaultPrevented)return;e.preventDefault();
  void window.fetch(a.getAttribute('href')!).then(async r=>{if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'下载失败');const blob=await r.blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=a.getAttribute('href')!.split('/').pop()||'file';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),10000);}).catch(err=>alert(err.message));
 });
}
