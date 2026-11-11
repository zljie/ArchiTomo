import { open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import type { ProjectStore } from './projects.ts';
import { ruleInsights, KIND_NAMES, type Insight, type InsightKind } from '../src/insights.ts';
import { ProjectError, head } from '../src/project.ts';
/**
 * 见解独立存储（ADR-007）：项目目录下 insights.json，不进入 project.json、不改 writeVersion。
 * observe 在浏览器轮询时执行：当前修订稳定 settleMs 后，把“上次观察修订 → 当前修订”作为一次合并变化计算规则见解。
 */
export type InsightFile={format:'archsketch-insights';lastRevisionId:string|null;items:Insight[];prefs:{off:boolean;muted:string[]}};
const MAX_ITEMS=300;const KINDS=Object.keys(KIND_NAMES);
const empty=():InsightFile=>({format:'archsketch-insights',lastRevisionId:null,items:[],prefs:{off:false,muted:[]}});
export class InsightStore{
 store:ProjectStore;settleMs:number;constructor(store:ProjectStore,settleMs=3000){this.store=store;this.settleMs=settleMs;}
 private async load(dir:string):Promise<InsightFile>{
  let h;try{h=await open(join(dir,'insights.json'),constants.O_RDONLY|constants.O_NOFOLLOW);const v=JSON.parse(await h.readFile('utf8')) as InsightFile;
   if(v?.format!=='archsketch-insights'||!Array.isArray(v.items)||!v.prefs)return empty();return {...v,prefs:{off:!!v.prefs.off,muted:Array.isArray(v.prefs.muted)?v.prefs.muted.filter(k=>KINDS.includes(k)):[]}};
  }catch{return empty();}finally{await h?.close();}
 }
 private async save(dir:string,f:InsightFile){f.items=f.items.slice(-MAX_ITEMS);const temp=join(dir,'insights.json.tmp-'+crypto.randomUUID());let h;try{h=await open(temp,'wx',0o600);await h.writeFile(JSON.stringify(f),'utf8');await h.close();h=undefined;await rename(temp,join(dir,'insights.json'));}finally{await h?.close();await unlink(temp).catch(()=>{});}}
 private change<T>(id:string,fn:(f:InsightFile,dir:string)=>Promise<T>|T){return this.store.locked(id,async dir=>{const f=await this.load(dir);const out=await fn(f,dir);await this.save(dir,f);return out;});}
 async read(id:string):Promise<InsightFile>{return this.store.locked(id,dir=>this.load(dir));}
 async observe(id:string,now=Date.now()):Promise<InsightFile>{
  const p=await this.store.read(id);const top=p.revisions.find(r=>r.id===p.headRevisionId)!;
  const f=await this.read(id);if(f.lastRevisionId===p.headRevisionId)return f;
  if(f.lastRevisionId&&Date.parse(top.createdAt)+this.settleMs>now)return f;
  return this.change(id,f=>{
   if(f.lastRevisionId===p.headRevisionId)return f;const from=p.revisions.find(r=>r.id===f.lastRevisionId);
   if(from&&!f.prefs.off){const batchId=crypto.randomUUID();const createdAt=new Date(now).toISOString();
    for(const x of ruleInsights(from.snapshot,head(p),p.questions))if(!f.prefs.muted.includes(x.kind))f.items.push({...x,id:crypto.randomUUID(),batchId,fromRevisionId:from.id,toRevisionId:p.headRevisionId,source:'rule',status:'new',createdAt});}
   f.lastRevisionId=p.headRevisionId;return f;
  });
 }
 async setStatus(id:string,insightId:string,status:'dismissed'|'adopted'):Promise<InsightFile>{
  if(!['dismissed','adopted'].includes(status))throw new ProjectError(400,'INVALID_INPUT','见解状态无效');
  return this.change(id,f=>{const i=f.items.find(x=>x.id===insightId);if(!i)throw new ProjectError(404,'INSIGHT_NOT_FOUND','见解不存在');i.status=status;return f;});
 }
 async setPrefs(id:string,p:{off?:boolean;mute?:string;unmute?:string}):Promise<InsightFile>{
  for(const k of [p.mute,p.unmute])if(k!==undefined&&!KINDS.includes(k))throw new ProjectError(400,'INVALID_INPUT','见解类别无效');
  return this.change(id,f=>{if(typeof p.off==='boolean')f.prefs.off=p.off;if(p.mute&&!f.prefs.muted.includes(p.mute))f.prefs.muted.push(p.mute);if(p.unmute)f.prefs.muted=f.prefs.muted.filter(k=>k!==p.unmute);return f;});
 }
 /** 最近一次变化（最新规则批次；没有时为上次观察修订 → 当前修订）。 */
 latestBatch(f:InsightFile):{batchId:string;fromRevisionId:string;toRevisionId:string;items:Insight[]}|null{
  const last=[...f.items].reverse().find(i=>i.source==='rule');if(!last)return null;return {batchId:last.batchId,fromRevisionId:last.fromRevisionId,toRevisionId:last.toRevisionId,items:f.items.filter(i=>i.batchId===last.batchId)};
 }
 async addAi(id:string,batch:{batchId:string;fromRevisionId:string;toRevisionId:string},items:{title:string;detail:string;objectIds:string[]}[],proposalId:string|null):Promise<InsightFile>{
  return this.change(id,f=>{const createdAt=new Date().toISOString();for(const x of items)f.items.push({id:crypto.randomUUID(),batchId:batch.batchId,fromRevisionId:batch.fromRevisionId,toRevisionId:batch.toRevisionId,source:'ai',kind:'ai' as InsightKind,severity:'info',title:x.title,detail:x.detail,objectIds:x.objectIds,...(proposalId?{proposalId}:{}),status:'new',createdAt});return f;});
 }
}
